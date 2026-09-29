const axios = require("axios");

function toRouteLocation(location, fallbackId) {
    const latitude = Number(location?.mapy ?? location?.latitude);
    const longitude = Number(location?.mapx ?? location?.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error(`좌표가 올바르지 않습니다: ${location?.name || fallbackId}`);
    }

    return {
        id: String(location?.id ?? fallbackId),
        name: String(location?.name || fallbackId),
        latitude,
        longitude,
    };
}

// ----------------------------------------------------------
// 도로 거리·동선 계산
// ----------------------------------------------------------
// 1순위: 우리 서버에 둔 경로 탐색 엔진 OSRM (서울·경기북부 도로 데이터를 미리 처리해 둠, 외부 의존 없음, 수십 ms)
// 2순위: OSRM이 없거나 응답하지 않으면 직선거리 × 도로 보정 계수로 추정한다(estimated 표시).
// 예전 경로 서버(osmnx)는 새 지역마다 해외 Overpass에서 도로 데이터를 실시간으로 받아, 그 서버가 막히면 1분 넘게 멈췄다.
const OSRM_URL = (process.env.OSRM_URL || "").replace(/\/$/, "");
const OSRM_WAIT_MS = 5000;
const FAILURE_COOLDOWN_MS = 60 * 1000;
const ROAD_DETOUR_FACTOR = 1.3;
let lastFailureAt = 0;

function straightKm(a, b) {
    const toRad = (value) => (value * Math.PI) / 180;
    const h = Math.sin(toRad(b.latitude - a.latitude) / 2) ** 2
        + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(toRad(b.longitude - a.longitude) / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// 모든 지점 쌍의 거리(km)·소요 시간(분) 표. OSRM이 안 되면 직선거리 추정(소요 시간은 없음).
async function distanceMatrix(points) {
    if (OSRM_URL && Date.now() - lastFailureAt > FAILURE_COOLDOWN_MS) {
        try {
            const coordinates = points.map((p) => `${p.longitude},${p.latitude}`).join(";");
            const response = await axios.get(`${OSRM_URL}/table/v1/driving/${coordinates}`, {
                params: { annotations: "distance,duration" },
                timeout: OSRM_WAIT_MS,
            });
            if (response.data?.code !== "Ok") throw new Error(response.data?.message || response.data?.code);
            // 도로가 연결되지 않은 쌍(null)은 추정값으로 채운다.
            const matrix = response.data.distances.map((row, i) => row.map((meters, j) => (
                meters == null ? straightKm(points[i], points[j]) * ROAD_DETOUR_FACTOR : meters / 1000
            )));
            const minutes = response.data.durations.map((row) => row.map((seconds) => (seconds == null ? null : seconds / 60)));
            return { matrix, minutes, estimated: false };
        } catch (error) {
            lastFailureAt = Date.now();
            console.warn(`[road-network] OSRM 실패, 잠시 직선거리 추정으로 대신합니다: ${error.message}`);
        }
    }
    const matrix = points.map((a) => points.map((b) => straightKm(a, b) * ROAD_DETOUR_FACTOR));
    return { matrix, minutes: null, estimated: true };
}

function round3(value) {
    return Math.round(value * 1000) / 1000;
}

async function getRoadDistances({ origin, destinations }) {
    const originPoint = toRouteLocation(origin, "origin");
    const points = destinations.map((destination, index) => toRouteLocation(destination, `destination-${index + 1}`));
    if (points.length === 0) return [];

    const { matrix, estimated } = await distanceMatrix([originPoint, ...points]);
    return points
        .map((point, index) => {
            const km = matrix[0][index + 1];
            return {
                id: point.id,
                name: point.name,
                distanceMeters: Math.round(km * 1000),
                distanceKm: round3(km),
                reachable: true,
                ...(estimated ? { estimated: true } : {}),
            };
        })
        .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

// 출발지에서 가장 가까운 곳부터 차례로 잇는다(예전 경로 서버와 같은 방식). 거리는 실제 도로 기준.
async function getOptimizedRoute({
    origin,
    destinations,
    returnToOrigin = false,
    // 출발지와 다른 곳에서 하루를 마칠 때(예: 첫날 출발지 → 숙소). 주면 마지막 관광지에서 이곳까지 간다.
    end = null,
}) {
    const originPoint = toRouteLocation(origin, "origin");
    const points = destinations.map((destination, index) => toRouteLocation(destination, `destination-${index + 1}`));
    const endPoint = end ? toRouteLocation(end, "end") : null;
    const hasFinalLeg = Boolean(endPoint) || returnToOrigin;
    if (points.length === 0) {
        return { stops: [], totalDistanceMeters: 0, totalDistanceKm: 0, returnToOrigin: hasFinalLeg, ...(end ? { end } : {}) };
    }

    const { matrix, minutes, estimated } = await distanceMatrix([originPoint, ...points, ...(endPoint ? [endPoint] : [])]);
    const finalNode = endPoint ? points.length + 1 : 0;
    const remaining = points.map((_, index) => index + 1);
    const stops = [];
    let current = 0;
    let total = 0;
    while (remaining.length) {
        let best = 0;
        remaining.forEach((node, index) => {
            if (matrix[current][node] < matrix[current][remaining[best]]) best = index;
        });
        const next = remaining.splice(best, 1)[0];
        const km = matrix[current][next];
        total += km;
        const point = points[next - 1];
        stops.push({
            order: stops.length + 1,
            id: point.id,
            name: point.name,
            latitude: point.latitude,
            longitude: point.longitude,
            fromPreviousMeters: Math.round(km * 1000),
            fromPreviousKm: round3(km),
            // OSRM 예상 주행 시간(분). 추정 모드에서는 없다.
            fromPreviousMinutes: minutes?.[current]?.[next] ?? null,
        });
        current = next;
    }
    const returnKm = hasFinalLeg ? matrix[current][finalNode] : 0;
    const returnMinutes = hasFinalLeg ? minutes?.[current]?.[finalNode] ?? null : null;
    return {
        stops,
        unreachableDestinationIds: [],
        // returnToOrigin/return* 는 "마지막 관광지 → 하루를 마치는 곳" 구간이다(end가 없으면 출발지로 복귀).
        returnToOrigin: hasFinalLeg,
        ...(end ? { end } : {}),
        returnDistanceMeters: hasFinalLeg ? Math.round(returnKm * 1000) : null,
        returnDistanceKm: hasFinalLeg ? round3(returnKm) : null,
        returnDurationMinutes: returnMinutes,
        totalDistanceMeters: Math.round((total + returnKm) * 1000),
        totalDistanceKm: round3(total + returnKm),
        ...(estimated ? { estimated: true } : {}),
    };
}

module.exports = {
    toRouteLocation,
    getRoadDistances,
    getOptimizedRoute,
};
