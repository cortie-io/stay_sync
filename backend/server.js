const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const env = require("./src/config/env");
const { connectDB } = require("./src/config/db");
const chatRoutes = require("./src/routes/chatRoutes");
const rankingRoutes = require("./src/routes/rankingRoutes");
const attractionRoutes = require("./src/routes/attractionRoutes");
const plannerRoutes = require("./src/routes/plannerRoutes");
const { startWeatherScheduler } = require("./src/jobs/weatherScheduler");
const { startAirQualityRefresh } = require("./src/services/airQualityService");
const {
    ensureRouteServer,
    stopRouteServer,
} = require("./src/services/routeServerProcessService");

const app = express();

// 화면과 API가 같은 주소(/api/)라 다른 사이트에서 부를 일이 없다 — 허용 주소만(쉼표로 여러 개: CORS_ORIGINS)
const corsOrigins = (process.env.CORS_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean);
if (process.env.NODE_ENV !== "production") corsOrigins.push("http://localhost:5173", "http://localhost:3000");
app.use(cors({ origin: corsOrigins }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    const requestId = req.get("x-request-id") || crypto.randomUUID();
    const startedAt = Date.now();
    req.requestId = requestId;
    res.set("x-request-id", requestId);
    console.log(`[chat-debug:${requestId}] START ${req.method} ${req.originalUrl}`);
    res.on("finish", () => {
        console.log(`[chat-debug:${requestId}] FINISH ${res.statusCode} ${Date.now() - startedAt}ms`);
    });
    res.on("close", () => {
        if (!res.writableFinished) {
            console.warn(`[chat-debug:${requestId}] CLIENT_CONNECTION_CLOSED ${Date.now() - startedAt}ms`);
        }
    });
    next();
});

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Stay Sync Backend API is running",
    });
});

app.use("/api/chat", chatRoutes);
app.use("/api/rankings", rankingRoutes);
app.use("/api/attractions", attractionRoutes);
app.use("/api/planner", plannerRoutes);

async function startServer() {
    await connectDB();
    await ensureRouteServer();

    startWeatherScheduler();
    // 대기질을 미리 받아 두어 챗봇 요청이 에어코리아 응답을 기다리지 않게 한다.
    startAirQualityRefresh();

    app.listen(env.port, () => {
        console.log(`Server Running : ${env.port}`);
    });
}

process.once("SIGINT", () => {
    stopRouteServer();
    process.exit(0);
});

process.once("SIGTERM", () => {
    stopRouteServer();
    process.exit(0);
});

startServer().catch((error) => {
    console.error("Server Startup Error:", error.message);
    stopRouteServer();
    process.exit(1);
});
