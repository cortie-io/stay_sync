const axios = require("axios");
const env = require("../config/env");
const { t, label } = require("./messageService");

const AIRKOREA_URL =
    "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty";
const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map();

const REGION_STATIONS = {
    고양: ["행신동", "식사동", "백마로(마두역)", "신원동", "주엽동"],
    파주: ["금촌동", "운정", "파주", "파주읍"],
    의정부: ["의정부동", "의정부1동", "송산3동"],
    양주: ["백석읍", "고읍"],
    동두천: ["보산동"],
    포천: ["관인면", "선단동", "일동면"],
    남양주: ["금곡동", "오남읍", "별내동", "화도읍", "경춘로", "와부읍", "진접읍"],
    구리: ["교문동", "동구동"],
    가평: ["가평", "설악면"],
    연천: ["연천", "전곡", "연천(DMZ)"],
};

function normalizeServiceKey(serviceKey) {
    const key = String(serviceKey || "").trim();
    if (!key.includes("%")) return key;
    try {
        return decodeURIComponent(key);
    } catch (error) {
        return key;
    }
}

function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
}

function average(values) {
    const valid = values.map(toNumber).filter((value) => value !== null);
    if (valid.length === 0) return null;
    return Math.round((valid.reduce((sum, value) => sum + value, 0) / valid.length) * 10) / 10;
}

function classifyPm10(value) {
    if (value === null) return "정보없음";
    if (value <= 30) return "좋음";
    if (value <= 80) return "보통";
    if (value <= 150) return "나쁨";
    return "매우나쁨";
}

function classifyPm25(value) {
    if (value === null) return "정보없음";
    if (value <= 15) return "좋음";
    if (value <= 35) return "보통";
    if (value <= 75) return "나쁨";
    return "매우나쁨";
}

function getWorstGrade(...grades) {
    const order = ["정보없음", "좋음", "보통", "나쁨", "매우나쁨"];
    return grades.reduce((worst, grade) => (
        order.indexOf(grade) > order.indexOf(worst) ? grade : worst
    ), "정보없음");
}

function matchesRegion(item, region) {
    return (REGION_STATIONS[region] || []).includes(item.stationName);
}

// 경기도 측정값을 백그라운드에서 미리 받아 둔다(startAirQualityRefresh). 사용자 요청은 받아 둔 값을 바로 쓰므로
// 에어코리아가 느리거나 멈춰도(504까지 30초) 챗봇이 기다리지 않는다. 받아 둔 값이 없을 때만 직접 받아 온다.
const REFRESH_INTERVAL_MS = 20 * 60 * 1000;
const MAX_STALE_MS = 3 * 60 * 60 * 1000;
let lastGood = null; // { items, savedAt }
let inFlight = null;

function fetchProvinceMeasurements() {
    if (inFlight) return inFlight;
    inFlight = axios.get(AIRKOREA_URL, {
        params: {
            serviceKey: normalizeServiceKey(env.airQuality.serviceKey),
            returnType: "json",
            numOfRows: 200,
            pageNo: 1,
            sidoName: "경기",
            ver: "1.4",
        },
        timeout: 30000,
    })
        .then((response) => {
            const items = response.data?.response?.body?.items;
            if (!Array.isArray(items)) throw new Error("에어코리아 응답에 측정값이 없습니다.");
            lastGood = { items, savedAt: Date.now() };
            return items;
        })
        .finally(() => {
            inFlight = null;
        });
    return inFlight;
}

async function getProvinceMeasurements() {
    if (lastGood && Date.now() - lastGood.savedAt < MAX_STALE_MS) return lastGood.items;
    return fetchProvinceMeasurements();
}

// 서버 시작 시 한 번, 이후 REFRESH_INTERVAL_MS마다 갱신한다. 실패하면 이전 값을 그대로 둔다.
function startAirQualityRefresh() {
    if (!env.airQuality.serviceKey) return;
    const refresh = () => fetchProvinceMeasurements()
        .then(() => cache.clear())
        .catch((error) => console.warn(`[AirKorea] 백그라운드 갱신 실패, 이전 값을 유지합니다: ${error.message}`));
    refresh();
    setInterval(refresh, REFRESH_INTERVAL_MS).unref();
}

async function getAirQuality(region) {
    const cached = cache.get(region);
    if (cached && Date.now() - cached.savedAt < CACHE_TTL_MS) return cached.value;
    if (!region || !env.airQuality.serviceKey) {
        return { available: false, grade: "정보없음", pm10: null, pm25: null, stations: [] };
    }

    try {
        const items = await getProvinceMeasurements();
        const stations = items.filter((item) => matchesRegion(item, region));
        const pm10 = average(stations.map(({ pm10Value }) => pm10Value));
        const pm25 = average(stations.map(({ pm25Value }) => pm25Value));
        const grade = getWorstGrade(classifyPm10(pm10), classifyPm25(pm25));
        const value = {
            available: pm10 !== null || pm25 !== null,
            grade,
            pm10,
            pm25,
            measuredAt: stations[0]?.dataTime || null,
            stations: stations.map(({ stationName }) => stationName),
            indoorRecommended: grade === "나쁨" || grade === "매우나쁨",
        };
        cache.set(region, { savedAt: Date.now(), value });
        return value;
    } catch (error) {
        console.warn(`[AirKorea] ${region} 대기질 조회 실패: ${error.message}`);
        return { available: false, grade: "정보없음", pm10: null, pm25: null, stations: [] };
    }
}

function buildAirQualityReply(context, language = "ko") {
    if (!context?.available) return t("airQuality.unavailable", {}, language);
    return t("airQuality.line", {
        grade: label("airQuality.grade", context.grade, language),
        pm10: context.pm10 ?? "-",
        pm25: context.pm25 ?? "-",
    }, language)
        + (context.indoorRecommended ? " · 실내 활동 권장" : "");
}

module.exports = {
    startAirQualityRefresh,
    classifyPm10,
    classifyPm25,
    getWorstGrade,
    getAirQuality,
    buildAirQualityReply,
};
