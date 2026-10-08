-- 로그·캐시 시간 칸을 시간대 정보가 있는 형식으로 바꾼다.
-- 지금까지는 UTC 시각이 시간대 없이 저장돼 DB 도구에서 9시간 늦게(UTC로) 보였다. 저장된 값은 UTC로 해석해 그대로 옮긴다.
ALTER TABLE "ChatLog" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "RouteLog" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "SavedTrip" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "ExternalApiCache" ALTER COLUMN "expiresAt" TYPE TIMESTAMPTZ(3) USING "expiresAt" AT TIME ZONE 'UTC';
ALTER TABLE "ExternalApiCache" ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';
