const { prisma } = require("../config/db");

/**
 * ==========================================================
 * Log Repository
 * ==========================================================
 *
 * 역할
 * - 채팅 한 턴(ChatLog)과 동선 추천 결과(RouteLog) 기록
 *
 * 기록은 대화 흐름과 무관하므로, 저장에 실패해도 예외를 던지지 않고
 * 경고만 남긴다. 호출하는 쪽은 await 하지 않고 흘려보내도 된다.
 * ==========================================================
 */

// 같은 DB를 여러 사이트(stay-sync, kbu-stay-sync)가 함께 쓰므로 어느 사이트의 기록인지 남긴다.
const SITE_ID = process.env.SITE_ID || null;

// Prisma Json 컬럼에 undefined를 넣으면 오류가 나므로 null로 통일한다.
function json(value) {
    return value === undefined ? null : value;
}

function text(value) {
    if (value === undefined || value === null) return null;
    return typeof value === "string" ? value : JSON.stringify(value);
}

async function saveChatLog(entry) {
    try {
        await prisma.chatLog.create({
            data: {
                site: SITE_ID,
                sessionId: String(entry.sessionId),
                requestId: entry.requestId || null,
                userMessage: String(entry.userMessage ?? ""),
                processedMessage: entry.processedMessage || null,
                locale: entry.locale || null,
                language: entry.language || null,
                stepAfter: entry.stepAfter || null,
                botReply: text(entry.botReply),
                quickReplies: json(entry.quickReplies),
                recommendations: json(entry.recommendations),
                facts: json(entry.facts),
                isError: Boolean(entry.isError),
                errorMessage: entry.errorMessage || null,
                latencyMs: Number.isFinite(entry.latencyMs) ? Math.round(entry.latencyMs) : null,
            },
        });
    } catch (error) {
        console.warn(`[chat-log] 저장 실패 (session=${entry.sessionId}): ${error.message}`);
    }
}

async function saveRouteLog({ sessionId, requestId, result }) {
    try {
        const facts = result.facts || {};
        await prisma.routeLog.create({
            data: {
                site: SITE_ID,
                sessionId: String(sessionId),
                requestId: requestId || null,
                serviceType: text(facts.service_type),
                region: text(facts.region),
                period: text(facts.period),
                startDate: text(facts.start_date),
                endDate: text(facts.end_date),
                companionType: text(facts.companion_type),
                accommodation: json(facts.accommodation),
                departure: json(facts.start_location ?? facts.departure_location),
                selectedPlaces: json(facts.final_selected_places ?? facts.selected_places),
                dailyRoutes: json(result.finalRoute) ?? [],
                kakaoRouteLinks: json(result.kakaoRouteLinks),
                reply: text(result.reply),
                facts: json(facts),
            },
        });
    } catch (error) {
        console.warn(`[route-log] 저장 실패 (session=${sessionId}): ${error.message}`);
    }
}

module.exports = { saveChatLog, saveRouteLog };
