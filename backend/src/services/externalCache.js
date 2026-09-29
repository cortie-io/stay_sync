const { prisma } = require("../config/db");

/**
 * ==========================================================
 * 외부 API 응답 캐시 (메모리 + DB)
 * ==========================================================
 *
 * TourAPI는 키마다 하루 호출 한도가 있다. 캐시가 메모리에만 있으면
 * 재배포할 때마다 수백 곳을 다시 조회해 한도를 넘기고, 같은 DB를 쓰는
 * 두 사이트(stay-sync, kbu-stay-sync)가 같은 조회를 따로 반복한다.
 * 그래서 성공한 결과는 DB(ExternalApiCache)에 저장해 공유한다.
 *
 * - 성공: 메모리 + DB에 ttlMs 동안 보관
 * - 일부만 성공(partial): 메모리에만 짧게 보관하고 DB에는 남기지 않는다
 * - 실패(한도 초과·타임아웃 등): 메모리에만 짧게 보관해 곧 다시 시도하고,
 *   만료된 DB 값이 있으면 그걸로 대신 응답한다
 * ==========================================================
 */

const FAILURE_TTL_MS = 10 * 60 * 1000;

const memory = new Map(); // key -> { value, expiresAt }
const inFlight = new Map(); // key -> Promise

function remember(key, value, ttlMs) {
    memory.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
}

async function readDb(key) {
    try {
        return await prisma.externalApiCache.findUnique({ where: { key } });
    } catch (error) {
        console.warn(`[external-cache] 읽기 실패 (${key}): ${error.message}`);
        return null;
    }
}

function writeDb(key, value, ttlMs) {
    const data = { value: { v: value }, expiresAt: new Date(Date.now() + ttlMs) };
    prisma.externalApiCache
        .upsert({ where: { key }, create: { key, ...data }, update: data })
        .catch((error) => console.warn(`[external-cache] 저장 실패 (${key}): ${error.message}`));
}

/**
 * @param {string} key      캐시 키 (예: "tourapi:detail:12345")
 * @param {number} ttlMs    성공한 결과를 보관할 기간
 * @param {() => Promise<{ value: any, partial?: boolean }>} loader
 *        외부 API를 호출한다. 일시적인 오류는 throw 해야 한다(빈 결과로 캐시되지 않도록).
 * @param {any} fallback    실패했고 저장된 값도 없을 때 돌려줄 값
 */
function cached(key, ttlMs, loader, fallback = null) {
    const hit = memory.get(key);
    if (hit && hit.expiresAt > Date.now()) return Promise.resolve(hit.value);
    if (inFlight.has(key)) return inFlight.get(key);

    const promise = (async () => {
        const row = await readDb(key);
        if (row && row.expiresAt > new Date()) return remember(key, row.value?.v ?? fallback, row.expiresAt - Date.now());

        try {
            const { value, partial } = await loader();
            if (partial) return remember(key, value, FAILURE_TTL_MS);
            writeDb(key, value, ttlMs);
            return remember(key, value, ttlMs);
        } catch (error) {
            console.warn(`[external-cache] 조회 실패, ${FAILURE_TTL_MS / 60000}분 뒤 재시도 (${key}): ${error.message}`);
            // 만료됐더라도 예전에 받아 둔 값이 있으면 그걸 쓴다.
            return remember(key, row ? row.value?.v ?? fallback : fallback, FAILURE_TTL_MS);
        }
    })().finally(() => inFlight.delete(key));

    inFlight.set(key, promise);
    return promise;
}

module.exports = { cached };
