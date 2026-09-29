-- CreateTable
CREATE TABLE "SavedTrip" (
    "id" SERIAL NOT NULL,
    "shareId" TEXT NOT NULL,
    "site" TEXT,
    "sessionId" TEXT,
    "title" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedTrip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SavedTrip_shareId_key" ON "SavedTrip"("shareId");

-- CreateIndex
CREATE INDEX "SavedTrip_sessionId_createdAt_idx" ON "SavedTrip"("sessionId", "createdAt");

