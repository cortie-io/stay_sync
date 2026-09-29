-- CreateTable
CREATE TABLE "ExternalApiCache" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalApiCache_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "ExternalApiCache_expiresAt_idx" ON "ExternalApiCache"("expiresAt");

