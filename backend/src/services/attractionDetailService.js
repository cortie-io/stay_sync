const { stripHtml } = require("./tourApiService");
const { cached } = require("./externalCache");
const { requestTourApi, hasTourApiKey } = require("./tourApiRequest");
const { extractTourApiItems } = require("../utils/tourApiResponse");

/**
 * ==========================================================
 * 관광지 상세 정보 (TourAPI detailCommon2 / detailIntro2 / detailInfo2 / detailImage2)
 * ==========================================================
 *
 * 상세 페이지에 최대한 많은 정보를 보여주기 위해, 관광공사가 관광지 유형
 * (contentTypeId)별로 제공하는 소개 항목(이용시간·쉬는 날·주차·요금 등)과
 * 반복 정보(입장료·화장실 등), 추가 사진 목록을 모아 화면용
 * { label, value } 목록으로 정리한다.
 *
 * 성공한 결과만 DB에 7일 캐시한다(externalCache). 실패는 잠시 뒤 다시 시도한다.
 * ==========================================================
 */

const KOR_SERVICE_BASE = "https://apis.data.go.kr/B551011/KorService2";
const REQUEST_TIMEOUT_MS = 6000;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_IMAGES = 12;

// detailIntro2 항목명은 유형별 접미사가 붙는다(infocenterculture, restdateshopping 등). 접미사를 떼고 라벨을 찾는다.
const TYPE_SUFFIX = /(culture|leports|shopping|food|lodging|festival)$/;

// 화면에 보여줄 순서대로 나열한다. 여기 없는 항목은 표시하지 않는다.
const INTRO_LABELS = [
    ["eventstartdate", "행사 시작일"],
    ["eventenddate", "행사 종료일"],
    ["eventplace", "행사 장소"],
    ["playtime", "공연·행사 시간"],
    ["usetime", "이용시간"],
    ["opentime", "영업시간"],
    ["restdate", "쉬는 날"],
    ["fairday", "장 서는 날"],
    ["useseason", "이용 시기"],
    ["openperiod", "개장 기간"],
    ["opendate", "개장일"],
    ["usefee", "이용요금"],
    ["discountinfo", "할인 정보"],
    ["spendtime", "관람 소요시간"],
    ["infocenter", "문의 및 안내"],
    ["reservation", "예약 안내"],
    ["bookingplace", "예매처"],
    ["parking", "주차"],
    ["parkingfee", "주차요금"],
    ["chkbabycarriage", "유모차 대여"],
    ["chkpet", "반려동물 동반"],
    ["chkcreditcard", "신용카드"],
    ["expguide", "체험 안내"],
    ["expagerange", "체험 가능 연령"],
    ["agelimit", "관람 가능 연령"],
    ["program", "행사 프로그램"],
    ["subevent", "부대 행사"],
    ["saleitem", "판매 품목"],
    ["shopguide", "매장 안내"],
    ["restroom", "화장실"],
    ["scale", "규모"],
    ["accomcount", "수용 인원"],
    ["sponsor1", "주최"],
    ["sponsor1tel", "주최 연락처"],
    ["sponsor2", "주관"],
    ["sponsor2tel", "주관 연락처"],
];
const INTRO_ORDER = new Map(INTRO_LABELS.map(([key], index) => [key, index]));
const INTRO_LABEL = new Map(INTRO_LABELS);

const HERITAGE_LABELS = {
    heritage1: "유네스코 세계문화유산",
    heritage2: "유네스코 세계자연유산",
    heritage3: "유네스코 세계기록유산",
};

async function callTourApi(path, params) {
    const response = await requestTourApi(
        `${KOR_SERVICE_BASE}/${path}`,
        {
            MobileOS: "ETC",
            MobileApp: "StaySync",
            _type: "json",
            numOfRows: 30,
            pageNo: 1,
            ...params,
        },
        { timeout: REQUEST_TIMEOUT_MS },
    );
    return extractTourApiItems(response);
}


function cleanValue(value) {
    return stripHtml(value)
        .replace(/\r/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function formatEventDate(value) {
    const match = String(value || "").match(/^(\d{4})(\d{2})(\d{2})$/);
    return match ? `${match[1]}.${match[2]}.${match[3]}` : value;
}

// "<a href="http://...">..." 형태든 맨 URL이든 첫 링크만 꺼낸다.
function extractHomepage(raw) {
    const text = String(raw || "");
    const href = text.match(/href=["']([^"']+)["']/i)?.[1] || text.match(/https?:\/\/[^\s"'<>]+/i)?.[0];
    if (!href) return null;
    return href.startsWith("http") ? href : `http://${href}`;
}

function buildIntroItems(intro) {
    const items = [];
    const heritage = [];

    for (const [rawKey, rawValue] of Object.entries(intro || {})) {
        if (HERITAGE_LABELS[rawKey]) {
            if (String(rawValue) === "1") heritage.push(HERITAGE_LABELS[rawKey]);
            continue;
        }
        const key = INTRO_LABEL.has(rawKey) ? rawKey : rawKey.replace(TYPE_SUFFIX, "");
        if (!INTRO_LABEL.has(key)) continue;

        let value = cleanValue(rawValue);
        if (!value || value === "선택안함") continue;
        if (key === "eventstartdate" || key === "eventenddate") value = formatEventDate(value);
        items.push({ key, label: INTRO_LABEL.get(key), value });
    }

    items.sort((a, b) => INTRO_ORDER.get(a.key) - INTRO_ORDER.get(b.key));
    const result = items.map(({ label, value }) => ({ label, value }));
    if (heritage.length) result.unshift({ label: "지정 현황", value: heritage.join(", ") });
    return result;
}

function buildInfoItems(infoRows, introItems) {
    const seen = new Set(introItems.map(({ label, value }) => `${label}:${value}`));
    return infoRows
        .map((row) => ({ label: cleanValue(row.infoname), value: cleanValue(row.infotext) }))
        .filter(({ label, value }) => label && value && !seen.has(`${label}:${value}`));
}

async function resolveDetail({ contentId, contentTypeId }) {
    const [common, intro, info, images] = await Promise.all([
        callTourApi("detailCommon2", { contentId, numOfRows: 1 }).then((rows) => rows[0] || {}),
        contentTypeId
            ? callTourApi("detailIntro2", { contentId, contentTypeId, numOfRows: 1 }).then((rows) => rows[0] || {})
            : {},
        contentTypeId ? callTourApi("detailInfo2", { contentId, contentTypeId }) : [],
        callTourApi("detailImage2", { contentId, imageYN: "Y" }),
    ]);

    const introItems = buildIntroItems(intro);
    return {
        homepage: extractHomepage(common.homepage),
        tel: cleanValue(common.tel) || null,
        telName: cleanValue(common.telname) || null,
        zipCode: common.zipcode || null,
        intro: introItems,
        info: buildInfoItems(info, introItems),
        images: [...new Set(
            images
                .map((image) => image.originimgurl || image.smallimageurl)
                .filter(Boolean)
                // 사이트가 https라 http 이미지는 브라우저가 막는다. 관광공사 이미지 서버는 https도 지원한다.
                .map((url) => url.replace(/^http:\/\//, "https://")),
        )].slice(0, MAX_IMAGES),
    };
}

function fetchAttractionDetail({ contentId, contentTypeId }) {
    if (!hasTourApiKey() || !contentId) return Promise.resolve(null);
    return cached(`tourapi:detail:${contentId}`, CACHE_TTL_MS, async () => ({
        value: await resolveDetail({ contentId, contentTypeId }),
    }));
}

module.exports = { fetchAttractionDetail, buildIntroItems, extractHomepage };
