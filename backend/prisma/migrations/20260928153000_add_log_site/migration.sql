-- 로그에 출처 사이트 추가 (같은 DB를 stay-sync와 kbu-stay-sync가 함께 쓴다)
ALTER TABLE "ChatLog" ADD COLUMN "site" TEXT;
ALTER TABLE "RouteLog" ADD COLUMN "site" TEXT;

-- 이 칸을 만들기 전의 기록은 모두 기존 사이트(stay-sync.cortie.io)에서 쌓였다.
UPDATE "ChatLog" SET "site" = 'stay-sync' WHERE "site" IS NULL;
UPDATE "RouteLog" SET "site" = 'stay-sync' WHERE "site" IS NULL;

-- CreateIndex
CREATE INDEX "ChatLog_site_createdAt_idx" ON "ChatLog"("site", "createdAt");

-- CreateIndex
CREATE INDEX "RouteLog_site_createdAt_idx" ON "RouteLog"("site", "createdAt");
