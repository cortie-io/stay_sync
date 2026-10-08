const { listDestinations, createItinerary, assist, saveTrip, saveTripFromChat, getTrip, getTrips } = require("../services/plannerService");
const { saveRouteLog, saveChatLog } = require("../repositories/logRepository");

function sendError(res, error, fallbackMessage, requestId) {
    console.error(`[planner:${requestId || "-"}] ${fallbackMessage}`, error.message);
    return res.status(error.status || 500).json({
        success: false,
        message: error.status ? error.message : fallbackMessage,
    });
}

async function getDestinations(req, res) {
    try {
        const destinations = await listDestinations({
            region: String(req.query.region || ""),
            query: String(req.query.q || ""),
            theme: String(req.query.theme || ""),
            limit: req.query.limit,
            ids: String(req.query.ids || "")
                .split(",")
                .map(Number)
                .filter((id) => Number.isInteger(id) && id > 0),
        });
        return res.json({ success: true, data: destinations });
    } catch (error) {
        return sendError(res, error, "여행지 목록을 불러오지 못했습니다.");
    }
}

async function postItinerary(req, res) {
    const requestId = req.requestId || null;
    try {
        const { sessionId, attractionIds, days, startDate, startLocation, accommodation, companion, dayGroups } = req.body || {};
        const itinerary = await createItinerary({ attractionIds, days, startDate, startLocation, accommodation, companion, dayGroups });

        // 챗봇 동선과 같은 RouteLog에 남긴다(serviceType = PLANNER).
        if (sessionId) {
            saveRouteLog({
                sessionId,
                requestId,
                result: {
                    facts: itinerary.facts,
                    finalRoute: itinerary.dailyRoutes,
                    kakaoRouteLinks: itinerary.kakaoRouteLinks,
                    reply: itinerary.story,
                },
            });
        }

        const { facts, dailyRoutes, ...data } = itinerary;
        return res.json({ success: true, data });
    } catch (error) {
        return sendError(res, error, "동선을 만들지 못했어요. 잠시 후 다시 시도해주세요.", requestId);
    }
}

async function postAssist(req, res) {
    const requestId = req.requestId || null;
    const startedAt = Date.now();
    const { sessionId, message, context } = req.body || {};
    if (!message || !String(message).trim()) {
        return res.status(400).json({ success: false, message: "메시지를 입력해주세요." });
    }
    try {
        const result = await assist({ message, context });
        if (sessionId) {
            saveChatLog({
                sessionId,
                requestId,
                userMessage: String(message),
                language: "ko",
                stepAfter: "PLANNER_ASSIST",
                botReply: result.reply,
                recommendations: result.recommendations,
                facts: { context: context || null, actions: result.actions },
                latencyMs: Date.now() - startedAt,
            });
        }
        return res.json({ success: true, data: result });
    } catch (error) {
        if (sessionId) {
            saveChatLog({
                sessionId,
                requestId,
                userMessage: String(message),
                stepAfter: "PLANNER_ASSIST",
                isError: true,
                errorMessage: error.message,
                latencyMs: Date.now() - startedAt,
            });
        }
        return sendError(res, error, "답변을 만들지 못했어요. 잠시 후 다시 시도해주세요.", requestId);
    }
}

async function postTrip(req, res) {
    try {
        const { sessionId, itinerary } = req.body || {};
        return res.json({ success: true, data: await saveTrip({ sessionId, itinerary }) });
    } catch (error) {
        return sendError(res, error, "일정을 저장하지 못했어요.");
    }
}

async function postTripFromChat(req, res) {
    try {
        return res.json({ success: true, data: await saveTripFromChat(req.body?.sessionId) });
    } catch (error) {
        return sendError(res, error, "일정을 저장하지 못했어요.");
    }
}

async function getTripById(req, res) {
    try {
        const trip = await getTrip(req.params.shareId);
        if (!trip) return res.status(404).json({ success: false, message: "일정을 찾을 수 없어요." });
        return res.json({ success: true, data: trip });
    } catch (error) {
        return sendError(res, error, "일정을 불러오지 못했어요.");
    }
}

// 브라우저에 저장해 둔 공유 ID 목록으로 "저장한 여행" 목록을 만든다(로그인 없이).
async function listTrips(req, res) {
    try {
        const ids = String(req.query.ids || "").split(",").map((id) => id.trim()).filter(Boolean);
        return res.json({ success: true, data: await getTrips(ids) });
    } catch (error) {
        return sendError(res, error, "저장한 여행을 불러오지 못했어요.");
    }
}

module.exports = {
    postTripFromChat, getDestinations, postItinerary, postAssist, postTrip, getTripById, listTrips };
