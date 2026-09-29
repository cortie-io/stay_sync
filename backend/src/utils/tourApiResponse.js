/**
 * TourAPI 응답에서 item 목록을 꺼낸다.
 *
 * 호출 한도 초과(HTTP 429)나 인증 오류는 "결과 없음"과 구분해야 한다. 그렇지 않으면
 * 일시적인 오류가 빈 결과로 캐시돼 한도가 풀린 뒤에도 사진·설명이 비어 보인다.
 * 그래서 정상 응답이 아니면 throw 한다.
 */
function extractTourApiItems(response) {
    if (response.status !== 200) {
        throw new Error(`TourAPI HTTP ${response.status}`);
    }
    const header = response.data?.response?.header;
    if (!header) {
        // 한도 초과·키 오류는 JSON이 아닌 XML/텍스트로 오기도 한다.
        throw new Error(`TourAPI 비정상 응답: ${String(response.data).slice(0, 80)}`);
    }
    if (header.resultCode && header.resultCode !== "0000") {
        throw new Error(`TourAPI resultCode ${header.resultCode} ${header.resultMsg || ""}`.trim());
    }
    const items = response.data.response.body?.items?.item;
    return Array.isArray(items) ? items : items ? [items] : [];
}

module.exports = { extractTourApiItems };
