-- CreateTable
CREATE TABLE "ChatLog" (
    "id" SERIAL NOT NULL,
    "sessionId" TEXT NOT NULL,
    "requestId" TEXT,
    "userMessage" TEXT NOT NULL,
    "processedMessage" TEXT,
    "locale" TEXT,
    "language" TEXT,
    "stepAfter" TEXT,
    "botReply" TEXT,
    "quickReplies" JSONB,
    "recommendations" JSONB,
    "facts" JSONB,
    "isError" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteLog" (
    "id" SERIAL NOT NULL,
    "sessionId" TEXT NOT NULL,
    "requestId" TEXT,
    "serviceType" TEXT,
    "region" TEXT,
    "period" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "companionType" TEXT,
    "accommodation" JSONB,
    "departure" JSONB,
    "selectedPlaces" JSONB,
    "dailyRoutes" JSONB NOT NULL,
    "kakaoRouteLinks" JSONB,
    "reply" TEXT,
    "facts" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RouteLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatLog_sessionId_createdAt_idx" ON "ChatLog"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatLog_createdAt_idx" ON "ChatLog"("createdAt");

-- CreateIndex
CREATE INDEX "RouteLog_sessionId_createdAt_idx" ON "RouteLog"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "RouteLog_createdAt_idx" ON "RouteLog"("createdAt");

