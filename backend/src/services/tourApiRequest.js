const axios = require("axios");
const env = require("../config/env");
const { normalizeServiceKey } = require("../utils/tourApiKey");

/**
 * ==========================================================
 * TourAPI(국문) 요청 — 메인 키 + 대체 키
 * ==========================================================
 *
 * 공공데이터포털 키는 하루 호출 한도가 있다. 메인 키(TOUR_API_SERVICE_KEY)가
 * 한도 초과를 받으면 대체 키(TOUR_API_FALLBACK_SERVICE_KEY, TOUR_API_FALLBACK_SERVICE_KEYS)로 차례로 다시 요청한다.
 * 한도가 찬 키는 COOLDOWN_MS 동안 건너뛰고, 그 뒤 다시 메인 키부터 시도한다
 * (한도는 매일 자정에 초기화된다).
 * ==========================================================
 */

const COOLDOWN_MS = 30 * 60 * 1000;

const keys = [...new Set(
    [env.tourApi.serviceKey, env.tourApi.fallbackServiceKey, ...env.tourApi.fallbackServiceKeys]
        .map(normalizeServiceKey)
        .filter(Boolean),
)];
const cooldownUntil = new Map(); // key -> timestamp

function hasTourApiKey() {
    return keys.length > 0;
}

// 한도 초과는 HTTP 429로 오거나, 200 응답의 resultCode 22 / XML 오류 문구로 온다.
function isQuotaExceeded(response) {
    if (response.status === 429) return true;
    if (response.data?.response?.header?.resultCode === "22") return true;
    return typeof response.data === "string" && response.data.includes("LIMITED_NUMBER_OF_SERVICE_REQUESTS");
}

/**
 * 응답을 그대로 돌려준다(오류 판정은 호출하는 쪽의 extractTourApiItems가 한다).
 * 모든 키가 한도 초과면 마지막 한도 초과 응답을 돌려준다.
 */
async function requestTourApi(url, params, { timeout }) {
    let lastResponse = null;

    for (const [index, key] of keys.entries()) {
        if ((cooldownUntil.get(key) || 0) > Date.now()) continue;

        const response = await axios.get(url, {
            params: { ...params, serviceKey: key },
            timeout,
            validateStatus: () => true,
        });
        if (!isQuotaExceeded(response)) return response;

        cooldownUntil.set(key, Date.now() + COOLDOWN_MS);
        console.warn(`[tourapi] ${index === 0 ? "메인" : `대체${index}`} 키 한도 초과 — ${COOLDOWN_MS / 60000}분 동안 건너뜀`);
        lastResponse = response;
    }

    if (lastResponse) return lastResponse;
    throw new Error("TourAPI 사용 가능한 키 없음 (모두 한도 초과 대기 중)");
}

module.exports = { requestTourApi, hasTourApiKey };
