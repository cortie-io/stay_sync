require("dotenv").config();

module.exports = {
    port: process.env.PORT,

    llm: {
        // openai | ollama (기본 ollama). openai면 OPENAI_* 설정을 쓴다.
        provider: (process.env.LLM_PROVIDER || "ollama").toLowerCase(),
        openaiApiKey: process.env.OPENAI_API_KEY,
        openaiModel: process.env.OPENAI_MODEL || "gpt-5.4-mini",
        // GPT-5 계열 추론 강도. 챗봇은 응답 속도가 중요해 기본은 추론을 끈다(none).
        openaiReasoningEffort: process.env.OPENAI_REASONING_EFFORT || "none",
        host: process.env.OLLAMA_HOST,
        port: process.env.OLLAMA_PORT,
        model: process.env.OLLAMA_MODEL,
        storyTimeoutMs: Number(process.env.STORY_LLM_TIMEOUT_MS) || 5000,
    },

    weather: {
        serviceKey: process.env.KMA_SERVICE_KEY,
    },

    tourApi: {
        serviceKey:
            process.env.TOUR_API_SERVICE_KEY
            || process.env.KMA_SERVICE_KEY,
        // 메인 키가 하루 호출 한도를 넘기면 차례로 대신 쓰는 키들 (src/services/tourApiRequest.js)
        fallbackServiceKey: process.env.TOUR_API_FALLBACK_SERVICE_KEY,
        // 추가 대체 키 — 쉼표로 여러 개
        fallbackServiceKeys: (process.env.TOUR_API_FALLBACK_SERVICE_KEYS || "").split(",").map((key) => key.trim()).filter(Boolean),

        // 영문 서비스(EngService2)는 data.go.kr에서 따로 활용신청해야 열린다.
        // 보통 같은 인증키가 그대로 쓰이므로 별도 키가 없으면 한국어 키를 쓴다.
        englishServiceKey:
            process.env.TOUR_API_ENG_SERVICE_KEY
            || process.env.TOUR_API_SERVICE_KEY
            || process.env.KMA_SERVICE_KEY,
    },

    airQuality: {
        serviceKey: process.env.AIRKOREA_SERVICE_KEY,
    },

    routeServer: {
        url: process.env.ROUTE_SERVER_URL || "http://127.0.0.1:8001",
        autoStart: process.env.ROUTE_SERVER_AUTO_START !== "false",
    },

    kakao: {
        restApiKey: process.env.KAKAO_REST_API_KEY,
    },

    db: {
        type: process.env.DB_TYPE,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        url: process.env.DATABASE_URL,
    },
};
