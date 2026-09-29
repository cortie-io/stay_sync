// DB에 저장된 관광공사 이미지 주소는 http인 경우가 많다. 사이트가 https라 그대로 쓰면 브라우저가 막으므로
// https로 바꾼다(관광공사 이미지 서버는 https를 지원한다).
function toHttps(url) {
    return url ? String(url).replace(/^http:\/\//, "https://") : null;
}

module.exports = { toHttps };
