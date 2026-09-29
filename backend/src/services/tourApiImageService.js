const { searchImageCandidates } = require("./kakaoImageService");
const { requestTourApi, hasTourApiKey } = require("./tourApiRequest");
const { cached } = require("./externalCache");
const { extractTourApiItems } = require("../utils/tourApiResponse");

/**
 * ==========================================================
 * TourAPI(KorService2) 실시간 이미지 조회
 * ==========================================================
 *
 * 관광지 이미지를 DB 스냅샷 대신 매 요청마다 한국관광공사
 * TourAPI로 조회한다. 한 곳의 이미지를 얻기 위해 아래 순서로
 * 시도해서, 개별 항목마다 서로 다른 실제 사진이 나오게 한다.
 *
 *   1) contentId가 있으면 detailCommon2(대표이미지)
 *   2) 그래도 없으면 detailImage2(추가 이미지 목록)
 *   3) 그래도 없거나 애초에 contentId가 없으면(검색량 통계에만
 *      잡히고 관광지 마스터와 매칭되지 않은 곳) searchKeyword2로
 *      이름 검색 — 제목이 이름과 실제로 일치하는 결과만 사용
 *      ("스타필드 고양" → "골프존마켓 스타필드 고양점" 같은 오매칭 방지)
 *   4) 그래도 없으면 카카오 이미지 검색("지역명 + 장소명")
 *
 * 같은 목록에서 두 곳이 같은 사진을 받지 않도록, 후보를 여러 개
 * 돌려주는 fetchImageCandidates도 제공한다.
 *
 * TourAPI는 하루 호출 한도가 있어 결과를 DB에 캐시해 재배포·여러
 * 사이트 간에 공유한다(externalCache). 호출이 실패하면 빈 결과로
 * 저장하지 않고 잠시 뒤 다시 시도한다.
 * ==========================================================
 */

const KOR_SERVICE_BASE = "https://apis.data.go.kr/B551011/KorService2";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7일 — 사진은 자주 바뀌지 않고, TourAPI 하루 호출 한도를 지켜야 한다
const REQUEST_TIMEOUT_MS = 4000;

async function callTourApi(path, params) {
    const response = await requestTourApi(
        `${KOR_SERVICE_BASE}/${path}`,
        {
            MobileOS: "ETC",
            MobileApp: "StaySync",
            _type: "json",
            numOfRows: 5,
            pageNo: 1,
            ...params,
        },
        { timeout: REQUEST_TIMEOUT_MS },
    );
    return extractTourApiItems(response);
}


async function imageFromDetailCommon(contentId) {
    const [item] = await callTourApi("detailCommon2", { contentId, numOfRows: 1 });
    return item?.firstimage || item?.firstimage2 || null;
}

async function imageFromDetailImage(contentId) {
    const [item] = await callTourApi("detailImage2", { contentId, imageYN: "Y", numOfRows: 1 });
    return item?.originimgurl || item?.smallimageurl || null;
}

// 공백·괄호·특수문자를 빼고 비교한다. "파주 임진각(평화누리공원)"처럼 괄호 안 별칭도 이름으로 인정하고,
// "구리 동구릉 [유네스코 세계유산]"처럼 대괄호로 붙은 설명은 떼고 본다.
function normalizeTitle(value) {
    return String(value || "").toLowerCase().replace(/\[[^\]]*\]/g, "").replace(/[\s()[\]·.,'"-]/g, "");
}

function titleMatches(title, keyword) {
    const target = normalizeTitle(keyword);
    if (!target) return false;
    const aliases = [title, ...(String(title).match(/\(([^)]+)\)/g) || []).map((alias) => alias.slice(1, -1))];
    return aliases.some((alias) => {
        const normalized = normalizeTitle(alias);
        return normalized === target
            // 지역명이 앞에 붙은 등록명("파주 임진각") 정도만 허용하고, 다른 매장명이 붙은 건 제외한다.
            || (normalized.endsWith(target) && normalized.length - target.length <= 4)
            || (target.endsWith(normalized) && normalized.length >= 3 && target.length - normalized.length <= 4);
    });
}

async function searchKeywordOnce(keyword, excludeContentId) {
    const list = await callTourApi("searchKeyword2", { keyword, numOfRows: 10 });
    const match = list.find((item) => (
        String(item.contentid) !== String(excludeContentId)
        && (item.firstimage || item.firstimage2)
        && titleMatches(item.title, keyword)
    ));
    return match?.firstimage || match?.firstimage2 || null;
}

// CSV 원본 placeName은 "롯데프리미엄아울렛파주점"처럼 브랜드명과 지점명이
// 붙어 있는데, TourAPI에 등록된 실제 제목은 "롯데프리미엄아울렛 파주점"처럼
// 띄어 써서 키워드 검색이 0건으로 실패하는 경우가 많다. "아울렛" 뒤에
// 공백을 넣어 한 번 더 시도한다.
function withOutletSpacing(keyword) {
    return keyword.replace(/아울렛(?=\S)/, "아울렛 ");
}

async function imageFromKeywordSearch(keyword, excludeContentId) {
    const direct = await searchKeywordOnce(keyword, excludeContentId);
    if (direct) return direct;

    const spaced = withOutletSpacing(keyword);
    if (spaced === keyword) return null;
    return searchKeywordOnce(spaced, excludeContentId);
}

// 일시적인 오류(한도 초과·타임아웃)는 throw 된다 — 호출하는 쪽에서 partial로 처리한다.
async function resolveTourApiImage({ contentId, name }) {
    if (contentId) {
        const fromCommon = await imageFromDetailCommon(contentId);
        if (fromCommon) return fromCommon;

        const fromImageList = await imageFromDetailImage(contentId);
        if (fromImageList) return fromImageList;
    }

    if (name) {
        return await imageFromKeywordSearch(name, contentId);
    }

    return null;
}

// 우선순위 순 후보 목록: TourAPI 공식 사진 1장 → 카카오 이미지 검색 결과들.
// 한쪽이 일시적으로 실패하면 partial로 표시해 DB에 오래 남기지 않는다.
async function resolveImageCandidates({ contentId, name, region }) {
    let partial = false;

    let tourApiImage = null;
    if (hasTourApiKey()) {
        try {
            tourApiImage = await resolveTourApiImage({ contentId, name });
        } catch (error) {
            partial = true;
            console.warn(`TourAPI 이미지 조회 실패 (contentId=${contentId}, name=${name}): ${error.message}`);
        }
    }

    let kakaoImages = [];
    if (name) {
        try {
            kakaoImages = await searchImageCandidates([region, name].filter(Boolean).join(" "));
        } catch (error) {
            partial = true;
            console.warn(`카카오 이미지 검색 실패 (name=${name}): ${error.message}`);
        }
    }

    return { value: [...new Set([tourApiImage, ...kakaoImages].filter(Boolean))], partial };
}

function fetchImageCandidates({ contentId, name, region }) {
    if (!contentId && !name) return Promise.resolve([]);

    const cacheKey = contentId ? `image:id:${contentId}` : `image:name:${region || ""}:${name}`;
    return cached(cacheKey, CACHE_TTL_MS, () => resolveImageCandidates({ contentId, name, region }), []);
}

async function fetchImage(params) {
    const [image] = await fetchImageCandidates(params);
    return image || null;
}

function fetchImageByContentId(contentId) {
    return fetchImage({ contentId });
}

module.exports = { fetchImage, fetchImageCandidates, fetchImageByContentId, titleMatches };
