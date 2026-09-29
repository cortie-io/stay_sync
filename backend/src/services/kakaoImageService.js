const axios = require("axios");
const env = require("../config/env");

/**
 * ==========================================================
 * 카카오(다음) 이미지 검색 — TourAPI에 사진이 없는 곳의 보충용
 * ==========================================================
 *
 * 검색량 통계에만 잡히고 TourAPI에는 없는 곳(쇼핑몰, 체육시설,
 * 전시장 등)은 대체 일러스트만 반복돼 보였다. "지역명 + 장소명"으로
 * 이미지 검색해, 카드에 쓸 만한 사진(가로형, 충분한 해상도, https)만
 * 정확도순으로 후보를 돌려준다. 실제로 열리는 사진만 남긴다.
 * ==========================================================
 */

const IMAGE_SEARCH_URL = "https://dapi.kakao.com/v2/search/image";
const REQUEST_TIMEOUT_MS = 4000;
const MIN_WIDTH = 500;
const VERIFY_TIMEOUT_MS = 3000;
const SITE_REFERER = "https://stay-sync.cortie.io/";

// 네이버 블로그·카페 이미지는 외부 사이트에서의 표시(핫링크)를 거의 다 막는다.
const BLOCKED_HOSTS = /(^|\.)(pstatic\.net|naver\.net|naver\.com|ntruss\.com)$/i;

function hostOf(url) {
    try {
        return new URL(url).hostname;
    } catch {
        return "";
    }
}

function isUsableImage(document) {
    const width = Number(document.width) || 0;
    const height = Number(document.height) || 0;
    // 사이트가 https라 http 이미지는 브라우저가 막는다. 세로로 긴 사진은 카드에서 크게 잘린다.
    return document.image_url?.startsWith("https://")
        && !BLOCKED_HOSTS.test(hostOf(document.image_url))
        && width >= MIN_WIDTH
        && width >= height * 0.9;
}

// 우리 사이트에서 띄웠을 때 실제로 이미지가 오는지 확인한다(핫링크 차단·삭제된 사진 걸러내기).
async function isLoadable(url) {
    try {
        const response = await axios.head(url, {
            headers: { Referer: SITE_REFERER, "User-Agent": "Mozilla/5.0" },
            timeout: VERIFY_TIMEOUT_MS,
            maxRedirects: 3,
            validateStatus: () => true,
        });
        return response.status === 200 && String(response.headers["content-type"] || "").startsWith("image/");
    } catch {
        return false;
    }
}

async function searchImageCandidates(query, limit = 3) {
    if (!env.kakao.restApiKey || !query) return [];

    const response = await axios.get(IMAGE_SEARCH_URL, {
        params: { query, sort: "accuracy", size: 20 },
        headers: { Authorization: `KakaoAK ${env.kakao.restApiKey}` },
        timeout: REQUEST_TIMEOUT_MS,
        validateStatus: () => true,
    });
    if (response.status !== 200) throw new Error(`카카오 이미지 검색 HTTP ${response.status}`);

    const urls = (response.data?.documents ?? []).filter(isUsableImage).map((document) => document.image_url);

    // 정확도순으로 확인하며 limit개가 모이면 멈춘다(확인 요청을 최소화).
    const verified = [];
    for (const url of urls.slice(0, 8)) {
        if (await isLoadable(url)) verified.push(url);
        if (verified.length >= limit) break;
    }
    return verified;
}

module.exports = { searchImageCandidates };
