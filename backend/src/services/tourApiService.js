const { cached } = require("./externalCache");
const { requestTourApi, hasTourApiKey } = require("./tourApiRequest");
const { extractTourApiItems } = require("../utils/tourApiResponse");

const DETAIL_COMMON_URL =
    "https://apis.data.go.kr/B551011/KorService2/detailCommon2";
// 소개글·홈페이지는 자주 바뀌지 않는다. 하루 호출 한도를 지키기 위해 DB에 캐시한다(externalCache).
const DETAIL_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeServiceKey(serviceKey) {
    const key = String(serviceKey || "").trim();
    if (!key.includes("%")) return key;

    try {
        return decodeURIComponent(key);
    } catch (error) {
        return key;
    }
}

function stripHtml(value) {
    return String(value || "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .trim();
}

async function getTourDetail(contentId) {
    const key = String(contentId || "");
    if (!key || !hasTourApiKey()) return null;

    // 실패(한도 초과 등)는 throw 되어 externalCache가 잠시 뒤 다시 시도한다 — 예전처럼 null로 영구 캐시하지 않는다.
    return cached(`tourapi:common:${key}`, DETAIL_CACHE_TTL_MS, async () => {
        const response = await requestTourApi(
            DETAIL_COMMON_URL,
            { MobileOS: "ETC", MobileApp: "StaySync", _type: "json", contentId: key },
            { timeout: 10000 },
        );
        const [item] = extractTourApiItems(response);
        if (!item) return { value: null };
        return {
            value: {
                image: item.firstimage || item.firstimage2 || null,
                description: stripHtml(item.overview),
                homepage: stripHtml(item.homepage),
            },
        };
    });
}

async function enrichRecommendationItems(items) {
    return await Promise.all(items.map(async (item) => {
        const detail = await getTourDetail(item.contentId);
        return {
            ...item,
            image: item.image || detail?.image || null,
            description: detail?.description || null,
        };
    }));
}

module.exports = {
    stripHtml,
    normalizeServiceKey,
    getTourDetail,
    enrichRecommendationItems,
};
