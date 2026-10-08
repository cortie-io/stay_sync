const crypto = require("node:crypto");
const { Prisma } = require("@prisma/client");
const { prisma } = require("../config/db");
const { getOptimizedRoute } = require("./roadNetworkService");
const { distributePlacesByDate } = require("./routePlanningService");
const { createTravelStory } = require("./travelStoryService");
const { buildKakaoRouteUrls } = require("./kakaoRouteExportService");
const { getTourDetail } = require("./tourApiService");
const { fetchImageCandidates } = require("./tourApiImageService");
const { getWeatherRecommendationContext } = require("./weatherRecommendationService");
const { recommendPopularAttractions } = require("./attractionRecommendationService");
const { detectInterestThemes, normalizeCompanionType, mapCompanionToThemes } = require("./ontologyService");
const { parseDuration } = require("./travelIntentService");
const { toHttps } = require("../utils/imageUrl");

/**
 * ==========================================================
 * AI 동선 플래너 (kbu 두 번째 인터페이스)
 * ==========================================================
 *
 * 챗봇과 같은 로직(테마 추천, 도로망 동선 계산, 여행 스토리, 날씨)을
 * "조건 정하기 → 여행지 담기 → 일정 확인·편집 → 저장·공유" 흐름으로 제공한다.
 * ==========================================================
 */

const DATA_YEAR = 2025;
const REGIONS = ["가평", "고양", "구리", "남양주", "동두천", "양주", "연천", "의정부", "파주", "포천"];
const THEMES = ["자연관광", "문화관광", "역사관광", "체험관광", "레저스포츠"];
// 관광지·문화시설·축제·레포츠만. 쇼핑(38)·음식점(39)·숙박(32)은 동선 대상에서 뺀다.
const TOUR_CONTENT_TYPES = ["12", "14", "15", "28"];
// 검색량 상위를 차지하지만 여행 목적지가 아닌 곳(골프장, 영화관)
const NON_TOUR_NAME_PATTERN = "(CC|GC)$|C\\.C|G\\.C|골프|컨트리클럽|CGV|메가박스|롯데시네마";
const NON_TOUR_NAME = new RegExp(NON_TOUR_NAME_PATTERN, "i");
const MAX_STOPS = 15;
const MAX_DAYS = 5;
const EXTERNAL_WAIT_MS = 3000;

const CONTENT_TYPE_LABELS = { 12: "관광지", 14: "문화시설", 15: "축제·행사", 28: "레포츠" };
// 유형별 기본 체류 시간(분) — 시간표 계산용
const STAY_MINUTES = { 12: 90, 14: 60, 15: 120, 28: 120 };
const DAY_START_MINUTES = 10 * 60;
const LUNCH_START_MINUTES = 12 * 60;
const LUNCH_MINUTES = 60;
// 경기북부 국도·지방도 평균 주행 속도 가정(km/h)과 주차·도보 여유(분)
const AVERAGE_SPEED_KMH = 40;
const TRANSFER_BUFFER_MINUTES = 5;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
// 플래너에서 고르는 동행자 유형 (챗봇 온톨로지와 같은 이름)
const COMPANIONS = ["혼자", "연인", "친구", "가족", "부모님", "아이동반"];
// 아이·부모님과 함께면 한 곳에서 조금 더 여유 있게 머문다.
const COMPANION_STAY_FACTOR = { 부모님: 1.25, 아이동반: 1.25 };

function withinBudget(promise, fallback, ms = EXTERNAL_WAIT_MS) {
    return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

function mostCommon(values) {
    const counts = new Map();
    values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([value]) => value);
}

function durationLabel(days) {
    return days === 1 ? "당일치기" : `${days - 1}박 ${days}일`;
}

// ----------------------------------------------------------
// 여행지 목록
// ----------------------------------------------------------

function toDestination(row) {
    return {
        id: row.id,
        name: row.title,
        region: row.region,
        tag: row.smallCategory || CONTENT_TYPE_LABELS[row.contentTypeId] || "관광지",
        theme: row.middleCategory || null,
        contentType: CONTENT_TYPE_LABELS[row.contentTypeId] || null,
        indoorOutdoor: row.indoorOutdoor || null,
        lat: row.mapy,
        lng: row.mapx,
        image: toHttps(row.firstImage),
        searchCount: row.searchCount,
    };
}

// 사진이 없는 여행지는 이름으로 찾아 채운다(캐시됨, 오래 걸리면 없이 응답). 같은 목록 안에서는 같은 사진을 쓰지 않는다.
async function fillMissingImages(destinations) {
    const used = new Set(destinations.map((d) => d.image).filter(Boolean));
    const missing = destinations.filter((d) => !d.image);
    const candidates = await Promise.all(missing.map((d) => (
        withinBudget(fetchImageCandidates({ name: d.name, region: d.region }), [], 2000)
    )));
    missing.forEach((d, index) => {
        const image = (candidates[index] || []).find((candidate) => !used.has(candidate)) || null;
        if (image) used.add(image);
        d.image = image;
    });
    return destinations;
}

/** 지역·테마·검색어별 여행지 목록. 2025년 검색량 합계가 높은 순이고, 검색량이 없는 곳은 뒤에 온다. */
async function listDestinations({ region, query, theme, limit = 40, ids = [] }) {
    // 순위 화면의 "이 곳들로 동선 만들기" — 고른 관광지를 순서 그대로 돌려준다.
    if (ids.length > 0) {
        const found = await findDestinationsByIds(ids.slice(0, 20));
        const byId = new Map(found.map((d) => [d.id, d]));
        return fillMissingImages(ids.map((id) => byId.get(id)).filter((d) => d && Number.isFinite(d.lat) && Number.isFinite(d.lng)));
    }
    const regionCondition = REGIONS.includes(region) ? Prisma.sql`AND a.region = ${region}` : Prisma.empty;
    const trimmedQuery = String(query || "").trim();
    const normalizedQuery = trimmedQuery.replace(/\s/g, "").toLowerCase();
    const queryCondition = normalizedQuery
        ? Prisma.sql`AND (a."normalizedTitle" LIKE ${`%${normalizedQuery}%`} OR a.title ILIKE ${`%${trimmedQuery}%`})`
        : Prisma.empty;
    const themeCondition = THEMES.includes(theme)
        ? Prisma.sql`AND EXISTS (SELECT 1 FROM "AttractionSearchStat" t WHERE t."attractionId" = a.id AND t."middleCategory" = ${theme})`
        : Prisma.empty;

    const rows = await prisma.$queryRaw`
        SELECT a.id, a.title, a.region, a."contentTypeId", a."firstImage", a."indoorOutdoor", a.mapx, a.mapy,
               COALESCE(SUM(s."searchCount"), 0)::integer AS "searchCount",
               MIN(s."middleCategory") AS "middleCategory",
               MIN(s."smallCategory") AS "smallCategory"
        FROM "Attraction" a
        LEFT JOIN "AttractionSearchStat" s ON s."attractionId" = a.id AND s.year = ${DATA_YEAR}
        WHERE a."contentTypeId" = ANY(${TOUR_CONTENT_TYPES})
          AND a.mapx IS NOT NULL AND a.mapy IS NOT NULL
          AND a.title !~* ${NON_TOUR_NAME_PATTERN}
          ${regionCondition}
          ${queryCondition}
          ${themeCondition}
        GROUP BY a.id
        ORDER BY "searchCount" DESC, a.id ASC
        LIMIT ${Math.min(Math.max(Number(limit) || 40, 1), 100)}
    `;
    return fillMissingImages(rows.map(toDestination));
}

async function findDestinationsByIds(ids) {
    if (ids.length === 0) return [];
    const rows = await prisma.$queryRaw`
        SELECT a.id, a.title, a.region, a."contentTypeId", a."contentId", a."firstImage", a."indoorOutdoor", a.mapx, a.mapy,
               COALESCE(SUM(s."searchCount"), 0)::integer AS "searchCount",
               MIN(s."middleCategory") AS "middleCategory",
               MIN(s."smallCategory") AS "smallCategory"
        FROM "Attraction" a
        LEFT JOIN "AttractionSearchStat" s ON s."attractionId" = a.id AND s.year = ${DATA_YEAR}
        WHERE a.id = ANY(${ids})
        GROUP BY a.id
    `;
    return rows.map((row) => ({ ...toDestination(row), contentId: row.contentId, contentTypeId: row.contentTypeId }));
}

// ----------------------------------------------------------
// 일정 만들기
// ----------------------------------------------------------

function straightKm(a, b) {
    const toRad = (value) => (value * Math.PI) / 180;
    const h = Math.sin(toRad(b.lat - a.lat) / 2) ** 2
        + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(toRad(b.lng - a.lng) / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// 하루에 묶일 곳끼리 가깝도록, 가장 가까운 곳을 차례로 이어 전체 순서를 먼저 정한다(날짜별 분배 전 단계).
function orderByProximity(places) {
    if (places.length <= 2) return places;
    let best = null;
    for (const start of places) {
        const route = [start];
        const rest = places.filter((place) => place !== start);
        let total = 0;
        while (rest.length) {
            const last = route[route.length - 1];
            let bestIndex = 0;
            rest.forEach((place, index) => {
                if (straightKm(last, place) < straightKm(last, rest[bestIndex])) bestIndex = index;
            });
            total += straightKm(last, rest[bestIndex]);
            route.push(rest.splice(bestIndex, 1)[0]);
        }
        if (!best || total < best.total) best = { route, total };
    }
    return best.route;
}

function roundTo5(minutes) {
    return Math.max(5, Math.round(minutes / 5) * 5);
}

// OSRM이 알려 준 실제 도로 소요 시간이 있으면 그걸 쓰고, 없으면(추정 모드) 평균 속도로 계산한다. 주차·도보 여유를 더한다.
function driveMinutes(km, roadMinutes = null) {
    if (!Number.isFinite(km) || km <= 0.2) return 0;
    const minutes = Number.isFinite(roadMinutes) ? roadMinutes : (km / AVERAGE_SPEED_KMH) * 60;
    return roundTo5(minutes + TRANSFER_BUFFER_MINUTES);
}

function clock(minutes) {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function addDays(dateText, offset) {
    const date = new Date(`${dateText}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
}

function isDateText(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

// 도착·출발 시각과 점심 시간을 채운 하루 시간표
function buildTimeline(stops, { hasOrigin }) {
    let now = DAY_START_MINUTES;
    let lunchTaken = false;
    const timeline = stops.map((stop, index) => {
        const drive = index === 0 && !hasOrigin ? 0 : driveMinutes(stop.fromPreviousKm, stop.fromPreviousMinutes);
        now += drive;
        let lunchBefore = false;
        // 점심 시간대에 도착하거나, 12시를 넘겨 머물게 되면 먼저 점심을 먹고 들른다.
        if (!lunchTaken && now >= LUNCH_START_MINUTES && index > 0) {
            lunchBefore = true;
            lunchTaken = true;
            now += LUNCH_MINUTES;
        }
        const arrive = now;
        now += stop.stayMinutes;
        return { ...stop, driveMinutes: drive, lunchBefore, arrive: clock(arrive), depart: clock(now) };
    });
    return { timeline, endMinutes: now };
}

async function weatherByDate({ region, startDate, endDate }) {
    if (!region || !startDate) return new Map();
    const context = await withinBudget(getWeatherRecommendationContext({ region, startDate, endDate }), null, 4000);
    return new Map((context?.forecasts || []).map((forecast) => [forecast.date, {
        minTemp: forecast.minTemp,
        maxTemp: forecast.maxTemp,
        rainProb: forecast.rainProb,
        indoorRecommended: forecast.situation === "실내권장",
        reasons: forecast.reasons,
    }]));
}

// 도로망 서버는 새 지역을 처음 계산할 때 OpenStreetMap(Overpass)에서 도로 데이터를 받는데, 외부 서비스라 느리거나 막힐 수 있다.
// 그럴 때도 일정은 나와야 하므로 직선거리 × 도로 보정 계수로 추정한 동선으로 대신한다(estimated 표시).
const ROAD_ROUTE_WAIT_MS = 20000;
const ROAD_DETOUR_FACTOR = 1.3;

function estimateRoute({ origin, destinations, returnToOrigin, end = null }) {
    const point = (place) => ({ lat: Number(place.mapy), lng: Number(place.mapx) });
    const remaining = [...destinations];
    const stops = [];
    let current = origin;
    let total = 0;
    while (remaining.length) {
        let bestIndex = 0;
        remaining.forEach((place, index) => {
            if (straightKm(point(current), point(place)) < straightKm(point(current), point(remaining[bestIndex]))) bestIndex = index;
        });
        const next = remaining.splice(bestIndex, 1)[0];
        const km = straightKm(point(current), point(next)) * ROAD_DETOUR_FACTOR;
        total += km;
        stops.push({ order: stops.length + 1, id: next.id, name: next.name, latitude: Number(next.mapy), longitude: Number(next.mapx), fromPreviousKm: Math.round(km * 1000) / 1000 });
        current = next;
    }
    const hasFinalLeg = Boolean(end) || returnToOrigin;
    const returnKm = hasFinalLeg && stops.length ? straightKm(point(current), point(end || origin)) * ROAD_DETOUR_FACTOR : 0;
    return {
        stops,
        returnToOrigin: hasFinalLeg,
        ...(end ? { end } : {}),
        returnDistanceKm: hasFinalLeg ? Math.round(returnKm * 1000) / 1000 : null,
        totalDistanceKm: Math.round((total + returnKm) * 1000) / 1000,
        estimated: true,
    };
}

async function routeWithFallback(params) {
    try {
        return await withinBudget(getOptimizedRoute(params), null, ROAD_ROUTE_WAIT_MS) || (() => {
            console.warn("[planner] 도로망 계산이 오래 걸려 추정 동선으로 대신합니다.");
            return estimateRoute(params);
        })();
    } catch (error) {
        console.warn(`[planner] 도로망 계산 실패, 추정 동선으로 대신합니다: ${error.message}`);
        return estimateRoute(params);
    }
}

function toRoutePlace(destination) {
    return { id: String(destination.id), name: destination.name, mapx: destination.lng, mapy: destination.lat };
}

/**
 * 선택한 여행지로 일자별 동선·시간표를 만든다.
 * - dayGroups가 있으면 사용자가 편집한 날짜 배치를 그대로 쓰고, 각 날 안의 방문 순서만 도로망 기준으로 다시 정한다.
 * - 없으면 가까운 곳끼리 묶어 여행 일수에 맞게 나눈다.
 */
function toPlacePoint(location, id, fallbackName) {
    if (!location || !Number.isFinite(Number(location.mapx)) || !Number.isFinite(Number(location.mapy))) return null;
    return { id, name: String(location.name || fallbackName).slice(0, 80), mapx: Number(location.mapx), mapy: Number(location.mapy) };
}

async function createItinerary({ attractionIds, days, startDate = null, startLocation = null, accommodation = null, companion = null, dayGroups = null, story: presetStory = null }) {
    const ids = [...new Set((attractionIds || []).map(Number).filter(Number.isInteger))].slice(0, MAX_STOPS);
    const groupIds = Array.isArray(dayGroups)
        ? dayGroups.map((group) => (Array.isArray(group) ? group.map(Number).filter(Number.isInteger) : [])).filter((group) => group.length)
        : null;
    const allIds = groupIds ? [...new Set(groupIds.flat())].slice(0, MAX_STOPS) : ids;
    if (allIds.length === 0) throw Object.assign(new Error("여행지를 한 곳 이상 담아주세요."), { status: 400 });

    const destinations = (await findDestinationsByIds(allIds)).filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lng));
    if (destinations.length === 0) throw Object.assign(new Error("선택한 여행지의 위치를 찾지 못했어요."), { status: 400 });
    const byId = new Map(destinations.map((d) => [d.id, d]));

    let groups;
    if (groupIds) {
        groups = groupIds.map((group) => group.map((id) => byId.get(id)).filter(Boolean)).filter((group) => group.length).slice(0, MAX_DAYS);
    } else {
        const travelDays = Math.min(Math.max(Number.parseInt(days, 10) || 1, 1), MAX_DAYS, destinations.length);
        const ordered = orderByProximity(destinations);
        groups = distributePlacesByDate(ordered, Array.from({ length: travelDays }, (_, i) => i + 1)).map(({ places }) => places);
    }

    const origin = toPlacePoint(startLocation, "origin", "출발지");
    // 숙소는 1박 이상일 때만 쓴다. 첫날 출발지 → … → 숙소, 가운데 날 숙소 → … → 숙소, 마지막 날 숙소 → … → 출발지.
    const stay = groups.length > 1 ? toPlacePoint(accommodation, "stay", "숙소") : null;
    const companionType = COMPANIONS.includes(companion) ? companion : null;
    const stayFactor = COMPANION_STAY_FACTOR[companionType] || 1;
    const regions = mostCommon(destinations.map((d) => d.region));
    const validStart = isDateText(startDate) ? startDate : null;
    const endDate = validStart ? addDays(validStart, groups.length - 1) : null;

    const [dailyRoutes, descriptions, weather] = await Promise.all([
        Promise.all(groups.map(async (group, index) => {
            const isLast = index === groups.length - 1;
            // 그날 출발하는 곳: 첫날은 출발지, 둘째 날부터는 숙소(없으면 출발지). 둘 다 없으면 그날 첫 여행지.
            const start = index === 0 ? origin : stay || origin;
            const dayOrigin = start || toRoutePlace(group[0]);
            const destinationsForDay = (start ? group : group.slice(1)).map(toRoutePlace);
            // 하루를 마치는 곳: 숙소가 있으면 마지막 날 전까지 숙소, 마지막 날은 출발지로 돌아간다.
            const end = stay ? (isLast ? origin : stay) : null;
            // 가운데 날처럼 출발한 곳(숙소)으로 돌아오면 복귀 구간, 다른 곳이면 그곳까지 가는 구간을 붙인다.
            const returnToOrigin = end ? end === start : Boolean(origin) && !isLast;
            const route = await routeWithFallback({ origin: dayOrigin, destinations: destinationsForDay, returnToOrigin, end: end && end !== start ? end : null });
            return { day: index + 1, date: validStart ? addDays(validStart, index) : null, origin: dayOrigin, hasStart: Boolean(start), endKind: end ? (end === stay ? "stay" : "home") : route.returnToOrigin ? "home" : null, ...route };
        })),
        // 스토리가 장소를 소개할 수 있도록 관광공사 소개글을 붙인다(캐시됨).
        Promise.all(destinations.map((d) => withinBudget(getTourDetail(d.contentId), null))),
        weatherByDate({ region: regions[0], startDate: validStart, endDate }),
    ]);
    const descriptionById = new Map(destinations.map((d, i) => [d.id, descriptions[i]?.description || null]));

    const selectedPlaces = destinations.map((d) => ({
        ...toRoutePlace(d),
        description: descriptionById.get(d.id),
        theme: d.theme,
        indoorOutdoor: d.indoorOutdoor,
    }));
    const facts = {
        language: "ko",
        service_type: "PLANNER",
        region: regions[0] || null,
        period: durationLabel(groups.length),
        start_date: validStart,
        end_date: endDate,
        trip_type: groups.length > 1 ? "숙박" : "당일치기",
        companion_type: companionType,
        start_location: origin,
        accommodation: stay,
        selected_places: selectedPlaces,
        final_selected_places: selectedPlaces,
    };
    // 이미 만들어 둔 이야기(챗봇 결과를 옮길 때)가 있으면 다시 만들지 않는다.
    const story = presetStory || await createTravelStory({ facts, dailyRoutes });

    const resultDays = dailyRoutes.map((route) => {
        // 출발지를 지정하지 않으면 그날 첫 여행지가 출발점이 되고, 경로 결과(stops)에는 빠져 있다.
        const routeStops = [
            ...(route.hasStart ? [] : [{ id: route.origin.id, fromPreviousKm: null }]),
            ...route.stops,
        ];
        const stops = routeStops
            .map((stop) => {
                const d = byId.get(Number(stop.id));
                if (!d) return null;
                return {
                    id: d.id,
                    name: d.name,
                    region: d.region,
                    tag: d.tag,
                    theme: d.theme,
                    indoorOutdoor: d.indoorOutdoor,
                    image: d.image,
                    lat: d.lat,
                    lng: d.lng,
                    fromPreviousKm: stop.fromPreviousKm == null ? null : Math.round(stop.fromPreviousKm * 10) / 10,
                    fromPreviousMinutes: stop.fromPreviousMinutes ?? null,
                    stayMinutes: roundTo5((STAY_MINUTES[d.contentTypeId] || 90) * stayFactor),
                };
            })
            .filter(Boolean);
        const { timeline, endMinutes } = buildTimeline(stops, { hasOrigin: route.hasStart });
        const returnKm = route.returnToOrigin && route.returnDistanceKm != null ? Math.round(route.returnDistanceKm * 10) / 10 : null;
        const returnDrive = returnKm ? driveMinutes(returnKm, route.returnDurationMinutes) : 0;
        const distanceKm = Math.round(Number(route.totalDistanceKm || 0) * 10) / 10;
        const dayDrive = timeline.reduce((sum, stop) => sum + stop.driveMinutes, 0) + returnDrive;
        const date = route.date;
        return {
            day: route.day,
            date,
            weekday: date ? WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()] : null,
            weather: date ? weather.get(date) || null : null,
            distanceKm,
            driveMinutes: dayDrive,
            startTime: clock(DAY_START_MINUTES),
            endTime: clock(endMinutes + returnDrive),
            returnToOrigin: Boolean(route.returnToOrigin),
            returnKm,
            // 그날 출발하는 곳과 하루를 마치는 곳(stay = 숙소로 이동, home = 출발지로 복귀)
            startName: route.hasStart ? route.origin.name : null,
            endName: route.returnToOrigin ? (route.end?.name || route.origin.name) : null,
            endKind: route.returnToOrigin ? route.endKind : null,
            // 도로망 대신 직선거리로 추정한 날
            estimated: Boolean(route.estimated),
            note: stops.length === 1 && distanceKm === 0
                ? "한 곳에 여유롭게 머무는 날"
                : `${stops.length}곳 · 차량 약 ${distanceKm}km${route.endKind === "stay" ? " · 숙소에서 1박" : route.returnToOrigin ? " · 출발지로 복귀" : ""}`,
            stops: timeline,
        };
    });

    const label = durationLabel(resultDays.length);
    return {
        title: `${regions.slice(0, 3).join("·")} ${label} 코스`,
        durationLabel: label,
        startDate: validStart,
        endDate,
        origin: origin ? { name: origin.name, lat: origin.mapy, lng: origin.mapx } : null,
        accommodation: stay ? { name: stay.name, lat: stay.mapy, lng: stay.mapx } : null,
        companion: companionType,
        totalKm: Math.round(resultDays.reduce((sum, day) => sum + day.distanceKm, 0) * 10) / 10,
        totalDriveMinutes: resultDays.reduce((sum, day) => sum + day.driveMinutes, 0),
        estimated: resultDays.some((day) => day.estimated),
        days: resultDays,
        kakaoRouteLinks: dailyRoutes.flatMap((route) => (
            buildKakaoRouteUrls(route).map((url, index) => ({ day: route.day, part: index + 1, url }))
        )),
        story,
        dayGroups: resultDays.map((day) => day.stops.map((stop) => stop.id)),
        generatedAt: new Date().toISOString(),
        // 로그용 (응답에서는 뺀다)
        facts,
        dailyRoutes,
    };
}

// ----------------------------------------------------------
// AI 어시스턴트 — 플래너 상태를 알고 추천·기간 변경·일정 생성을 돕는다
// ----------------------------------------------------------

const BUILD_PATTERN = /(일정|코스|동선|루트|계획).{0,8}(짜|만들|세워|잡아|추천)|짜\s*줘|만들어\s*줘/;
const RECOMMEND_PATTERN = /추천|어디|가볼|갈\s*만|좋은\s*곳|명소|여행지|볼거리|가\s*볼/;
const CLEAR_PATTERN = /(다|전부|모두)\s*(빼|지워|삭제)|초기화|비워/;
const INDOOR_PATTERN = /비\s*(오|와)|실내|우천|더운|추운|미세먼지/;

// 기존 parseDuration은 '당일치기'를 여행 유형으로만 다루므로, 플래너에서는 일수로도 읽는다.
function parsePlannerDays(text) {
    if (/당일/.test(text)) return 1;
    const parsed = parseDuration(text);
    if (parsed) return parsed;
    const plain = text.match(/(\d)\s*일\s*(일정|코스|동안|여행|로|으로)/);
    return plain ? Number.parseInt(plain[1], 10) : null;
}

async function summarizeSelection(selectedIds) {
    const selected = await findDestinationsByIds(selectedIds);
    return { selected, regions: mostCommon(selected.map((d) => d.region)) };
}

async function assist({ message, context = {} }) {
    const text = String(message || "").trim();
    const selectedIds = (context.selectedIds || []).map(Number).filter(Number.isInteger);
    const currentDays = Number(context.days) || 1;
    const { selected, regions } = await summarizeSelection(selectedIds);

    const mentionedRegion = REGIONS.find((region) => text.includes(region)) || null;
    const region = mentionedRegion || context.region || regions[0] || null;
    const companion = normalizeCompanionType(text);
    const themes = [...new Set([...detectInterestThemes(text), ...mapCompanionToThemes(companion)])]
        .filter((theme) => theme !== "쇼핑");
    const indoor = INDOOR_PATTERN.test(text);
    const requestedDays = parsePlannerDays(text);

    const actions = [];
    const lines = [];

    if (CLEAR_PATTERN.test(text)) {
        actions.push({ type: "clear" });
        return { reply: "담아 둔 여행지를 모두 비웠어요. 새로 계획해 볼까요?", actions, recommendations: [] };
    }

    if (requestedDays && requestedDays >= 1) {
        const days = Math.min(requestedDays, MAX_DAYS);
        if (days !== currentDays) {
            actions.push({ type: "setDays", days });
            lines.push(`여행 기간을 ${durationLabel(days)}로 바꿨어요.`);
        }
    }

    // "부모님이랑", "아이랑"처럼 동행자를 말하면 플래너의 동행 선택도 맞춘다.
    if (COMPANIONS.includes(companion) && companion !== context.companion) {
        actions.push({ type: "setCompanion", companion });
        lines.push(`동행을 '${companion === "아이동반" ? "아이 동반" : companion}'(으)로 맞췄어요.`);
    }

    const wantsBuild = BUILD_PATTERN.test(text);
    const wantsRecommend = RECOMMEND_PATTERN.test(text) || themes.length > 0 || Boolean(mentionedRegion) || indoor;

    // 담은 곳이 있으면 일정 요청을 먼저 처리한다.
    if (wantsBuild && selected.length > 0 && !(mentionedRegion && !selected.some((d) => d.region === mentionedRegion))) {
        actions.push({ type: "build" });
        lines.push(`담아 둔 ${selected.length}곳으로 ${durationLabel(actions.find((a) => a.type === "setDays")?.days || currentDays)} 일정을 만들게요.`);
        return { reply: lines.join("\n"), actions, recommendations: [] };
    }

    if (!wantsRecommend && !wantsBuild) {
        if (lines.length) return { reply: lines.join("\n"), actions, recommendations: [] };
        return {
            reply: "원하는 여행을 편하게 말씀해 주세요. 예를 들어 이렇게요.\n· 가평에서 아이랑 가기 좋은 곳 추천해줘\n· 비 오는 날 파주 실내 명소\n· 담은 곳으로 1박 2일 일정 짜줘",
            actions,
            recommendations: [],
        };
    }

    if (!region) {
        actions.push({ type: "askRegion", regions: REGIONS });
        lines.push("어느 지역으로 떠나실 건가요? 아래에서 골라 주세요.");
        return { reply: lines.join("\n"), actions, recommendations: [] };
    }

    let result = null;
    try {
        result = await recommendPopularAttractions({
            region,
            themes,
            tripType: "당일치기",
            recommendedHistory: selectedIds,
            indoorOutdoor: indoor ? "실내" : null,
        });
    } catch (error) {
        console.warn(`[planner-assist] 추천 실패: ${error.message}`);
    }
    // 테마 조건이 너무 좁으면 지역 인기순으로 넓힌다.
    if ((!result || result.recommendations.length === 0) && (themes.length || indoor)) {
        result = await recommendPopularAttractions({ region, tripType: "당일치기", recommendedHistory: selectedIds }).catch(() => null);
        if (result?.recommendations.length) lines.push("조건에 딱 맞는 곳이 적어 지역 인기 여행지로 넓혀 찾았어요.");
    }

    const recommendations = (result?.recommendations || [])
        .filter((r) => r.theme !== "쇼핑" && !NON_TOUR_NAME.test(r.name) && Number.isFinite(r.mapx) && Number.isFinite(r.mapy))
        .slice(0, 6)
        .map((r) => ({
            id: r.id,
            name: r.name,
            region: r.region,
            tag: r.category || r.theme || "관광지",
            theme: r.theme || null,
            indoorOutdoor: r.indoorOutdoor || null,
            lat: r.mapy,
            lng: r.mapx,
            image: toHttps(r.image),
            description: r.description ? String(r.description).slice(0, 140) : null,
        }));

    const conditions = [
        companion && `${companion} 여행`,
        themes.length && themes.map((theme) => theme.replace("관광", "")).join("·"),
        indoor && "실내",
    ].filter(Boolean);
    if (recommendations.length) {
        lines.unshift(`${region}${conditions.length ? ` · ${conditions.join(" · ")}` : ""} 기준으로 인기 여행지를 골라 봤어요. 마음에 드는 곳을 담아 보세요.`);
        if (wantsBuild) lines.push("여행지를 담은 뒤 '일정 짜줘'라고 말씀하시면 바로 일정을 만들어 드릴게요.");
    } else {
        lines.unshift(`${region}에서 조건에 맞는 여행지를 찾지 못했어요. 다른 지역이나 테마로 다시 말씀해 주세요.`);
    }
    actions.push({ type: "recommend", region });
    return { reply: lines.join("\n"), actions, recommendations };
}

// ----------------------------------------------------------
// 저장·공유
// ----------------------------------------------------------

// express.json() 기본 요청 한도(100KB) 안에 들어와야 한다.
const MAX_PAYLOAD_BYTES = 90 * 1024;

async function saveTrip({ sessionId, itinerary }) {
    if (!itinerary || !Array.isArray(itinerary.days) || itinerary.days.length === 0) {
        throw Object.assign(new Error("저장할 일정이 없어요."), { status: 400 });
    }
    const payload = JSON.parse(JSON.stringify(itinerary));
    if (Buffer.byteLength(JSON.stringify(payload)) > MAX_PAYLOAD_BYTES) {
        throw Object.assign(new Error("일정이 너무 커서 저장할 수 없어요."), { status: 400 });
    }
    const trip = await prisma.savedTrip.create({
        data: {
            shareId: crypto.randomBytes(6).toString("base64url"),
            site: process.env.SITE_ID || null,
            sessionId: sessionId ? String(sessionId) : null,
            title: String(itinerary.title || "나의 경기북부 여행").slice(0, 120),
            payload,
        },
    });
    return { shareId: trip.shareId, title: trip.title, createdAt: trip.createdAt };
}

/**
 * 챗봇 대화로 완성한 일정을 공유 일정으로 저장한다(키오스크 결과 QR용).
 * 브라우저가 보낸 내용이 아니라 DB에 저장된 그 세션의 최종 동선만 쓰므로 위조할 수 없다. 같은 세션은 한 번만 저장한다.
 */
const CHAT_COMPANIONS = { 혼자: "혼자", 연인: "연인", 친구: "친구", 가족: "가족", 부모님: "부모님", 아이동반: "아이동반", 단체: "친구" };

async function saveTripFromChat(sessionId) {
    const id = String(sessionId || "").slice(0, 100);
    if (!id) throw Object.assign(new Error("대화 정보가 없어요."), { status: 400 });
    const existing = await prisma.savedTrip.findFirst({ where: { sessionId: id }, orderBy: { createdAt: "desc" } });
    if (existing && existing.payload?.source === "chat") {
        return { shareId: existing.shareId, title: existing.title, createdAt: existing.createdAt, reused: true };
    }
    const session = await prisma.travelSession.findUnique({ where: { sessionId: id } });
    const facts = session?.facts || {};
    const finalRoute = Array.isArray(facts.final_route) ? facts.final_route : session?.finalRoute;
    if (!session || !Array.isArray(finalRoute) || finalRoute.length === 0) {
        throw Object.assign(new Error("아직 완성된 일정이 없어요."), { status: 404 });
    }
    const dayGroups = finalRoute
        .map((route) => (route.stops || []).map((stop) => Number(stop.id)).filter(Number.isInteger))
        .filter((group) => group.length);
    if (dayGroups.length === 0) throw Object.assign(new Error("일정에 담긴 관광지가 없어요."), { status: 404 });
    const base = facts.accommodation || facts.start_location || facts.departure_location || null;
    const itinerary = await createItinerary({
        attractionIds: dayGroups.flat(),
        days: dayGroups.length,
        dayGroups,
        startDate: facts.start_date || null,
        startLocation: base,
        companion: CHAT_COMPANIONS[facts.companion_type] || null,
        story: typeof facts.final_story === "string" ? facts.final_story : null,
    });
    const { facts: _facts, dailyRoutes: _routes, ...clean } = itinerary;
    return saveTrip({ sessionId: id, itinerary: { ...clean, source: "chat" } });
}

async function getTrip(shareId) {
    const trip = await prisma.savedTrip.findUnique({ where: { shareId: String(shareId) } });
    if (!trip) return null;
    return { shareId: trip.shareId, title: trip.title, createdAt: trip.createdAt, itinerary: trip.payload };
}

async function getTrips(shareIds) {
    const ids = [...new Set((shareIds || []).map(String))].slice(0, 50);
    if (ids.length === 0) return [];
    const trips = await prisma.savedTrip.findMany({ where: { shareId: { in: ids } }, orderBy: { createdAt: "desc" } });
    return trips.map((trip) => ({
        shareId: trip.shareId,
        title: trip.title,
        createdAt: trip.createdAt,
        durationLabel: trip.payload?.durationLabel || null,
        startDate: trip.payload?.startDate || null,
        stopCount: (trip.payload?.days || []).reduce((sum, day) => sum + (day.stops?.length || 0), 0),
        cover: trip.payload?.days?.[0]?.stops?.find((stop) => stop.image)?.image || null,
    }));
}

module.exports = {
    saveTripFromChat,
    listDestinations,
    createItinerary,
    assist,
    saveTrip,
    getTrip,
    getTrips,
    REGIONS,
    THEMES,
};
