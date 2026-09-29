const axios = require("axios");
const env = require("../config/env");
const { parseLLMJson } = require("../utils/jsonUtils");

/**
 * ==========================================================
 * LLM Service
 * ==========================================================
 *
 * LLM_PROVIDER로 호출 대상을 고른다.
 * - openai: OpenAI Chat Completions (OPENAI_API_KEY, OPENAI_MODEL, OPENAI_REASONING_EFFORT)
 * - ollama: 로컬·연구실 Ollama 서버 (OLLAMA_HOST, OLLAMA_PORT, OLLAMA_MODEL)
 * 호출하는 쪽은 provider와 상관없이 callLLM / callLLMJson만 쓴다.
 * ==========================================================
 */

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const OLLAMA_URL = `http://${env.llm.host}:${env.llm.port}/api/chat`;

function buildMessages(systemPrompt, userPrompt) {
    return [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
    ];
}

async function callOpenAI(systemPrompt, userPrompt, timeout) {
    const isReasoningModel = /^(gpt-5|o\d)/.test(env.llm.openaiModel);
    const response = await axios.post(OPENAI_URL, {
        model: env.llm.openaiModel,
        messages: buildMessages(systemPrompt, userPrompt),
        ...(isReasoningModel ? { reasoning_effort: env.llm.openaiReasoningEffort } : {}),
    }, {
        headers: { Authorization: `Bearer ${env.llm.openaiApiKey}` },
        timeout,
    });
    return response.data?.choices?.[0]?.message?.content || "";
}

async function callOllama(systemPrompt, userPrompt, timeout) {
    const response = await axios.post(OLLAMA_URL, {
        model: env.llm.model,
        stream: false,
        messages: buildMessages(systemPrompt, userPrompt),
    }, {
        timeout,
    });
    return response.data?.message?.content || "";
}

/**
 * LLM 호출
 *
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @returns {Promise<string>}
 */
async function callLLM(systemPrompt, userPrompt, options = {}) {
    const timeout = options.timeout ?? 30000;
    try {
        return env.llm.provider === "openai"
            ? await callOpenAI(systemPrompt, userPrompt, timeout)
            : await callOllama(systemPrompt, userPrompt, timeout);
    } catch (error) {
        console.error(`LLM Call Failed (${env.llm.provider})`);

        if (error.response) {
            console.error(JSON.stringify(error.response.data).slice(0, 500));
        } else {
            console.error(error.message);
        }

        throw new Error("LLM 호출에 실패했습니다.");
    }
}

/**
 * JSON 응답을 기대하는 호출
 *
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @returns {Promise<object|null>}
 */
async function callLLMJson(systemPrompt, userPrompt) {
    const output = await callLLM(systemPrompt, userPrompt);
    return parseLLMJson(output);
}

module.exports = {
    callLLM,
    callLLMJson,
};
