// AI 동선 플래너(두 번째 인터페이스) — 타입, 백엔드 API, 화면용 계산

const API_BASE_URL = (
  (typeof window === "undefined" && process.env.API_INTERNAL_URL) ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:4500"
).replace(/\/$/, "")

// ---------- 타입 ----------

export type Destination = {
  id: number
  name: string
  region: string
  tag: string
  theme?: string | null
  contentType?: string | null
  indoorOutdoor?: string | null
  lat: number
  lng: number
  image: string | null
  searchCount?: number
  description?: string | null
}

export type MapPoint = { id: number | string | null; name: string; lat: number; lng: number }

export type StartLocation = { name: string; address?: string | null; mapx: number; mapy: number }

export type DayWeather = {
  minTemp: number | null
  maxTemp: number | null
  rainProb: number | null
  indoorRecommended: boolean
  reasons: string[]
}

export type ItineraryStop = MapPoint & {
  id: number
  region?: string
  tag?: string
  theme?: string | null
  indoorOutdoor?: string | null
  image?: string | null
  fromPreviousKm?: number | null
  stayMinutes?: number
  driveMinutes?: number
  lunchBefore?: boolean
  arrive?: string
  depart?: string
}

export type ItineraryDay = {
  day: number
  date?: string | null
  weekday?: string | null
  weather?: DayWeather | null
  distanceKm?: number
  driveMinutes?: number
  startTime?: string
  endTime?: string
  returnToOrigin?: boolean
  returnKm?: number | null
  // 그날 출발하는 곳 / 하루를 마치는 곳 (stay = 숙소로 이동, home = 출발지로 복귀)
  startName?: string | null
  endName?: string | null
  endKind?: "stay" | "home" | null
  estimated?: boolean
  note: string
  stops: ItineraryStop[]
}

export type Itinerary = {
  title: string
  durationLabel?: string
  startDate?: string | null
  endDate?: string | null
  origin?: { name: string; lat: number; lng: number } | null
  accommodation?: { name: string; lat: number; lng: number } | null
  companion?: Companion | null
  totalKm?: number
  totalDriveMinutes?: number
  estimated?: boolean
  days: ItineraryDay[]
  kakaoRouteLinks?: { day: number; part: number; url: string }[]
  story?: string | null
  dayGroups?: number[][]
  generatedAt?: string
}

export type AssistAction =
  | { type: "recommend"; region: string }
  | { type: "setDays"; days: number }
  | { type: "build" }
  | { type: "clear" }
  | { type: "askRegion"; regions: string[] }
  | { type: "setCompanion"; companion: Companion }

export type AssistResult = { reply: string; actions: AssistAction[]; recommendations: Destination[] }

export type SavedTripSummary = {
  shareId: string
  title: string
  createdAt: string
  durationLabel: string | null
  startDate: string | null
  stopCount: number
  cover: string | null
}

// ---------- 상수 ----------

export const PLANNER_REGIONS = ["가평", "고양", "구리", "남양주", "동두천", "양주", "연천", "의정부", "파주", "포천"] as const

export const PLANNER_THEMES = [
  { id: "자연관광", label: "자연" },
  { id: "문화관광", label: "문화" },
  { id: "역사관광", label: "역사" },
  { id: "체험관광", label: "체험" },
  { id: "레저스포츠", label: "레포츠" },
] as const

export const DURATIONS = [
  { id: "day", label: "당일치기", days: 1 },
  { id: "1n2d", label: "1박 2일", days: 2 },
  { id: "2n3d", label: "2박 3일", days: 3 },
  { id: "3n4d", label: "3박 4일", days: 4 },
  { id: "4n5d", label: "4박 5일", days: 5 },
] as const

export type DurationId = (typeof DURATIONS)[number]["id"]

export const MAX_STOPS = 15

// AI 플래너의 기본 출발지 — 일산 킨텍스로 고정한다(출발지 칸의 핀 아이콘이 고정을 푸는 숨은 버튼).
export const FIXED_START_LOCATION: StartLocation = {
  name: "일산 킨텍스",
  address: "경기 고양시 일산서구 킨텍스로 217-60",
  mapx: 126.74580260116382,
  mapy: 37.66893329553114,
}

// 일자별 지도 선 색 (테마 톤에 맞춘 차분한 색)
export const DAY_COLORS = ["#4e6e61", "#1c1a19", "#b07d48", "#4f6d8f", "#9a5b6e"]

export function durationForDays(days: number) {
  return DURATIONS.find((d) => d.days === days) ?? DURATIONS[0]
}

export function formatId(n: number) {
  return String(n).padStart(2, "0")
}

export function formatMinutes(minutes = 0) {
  if (minutes < 60) return `${minutes}분`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}시간 ${m}분` : `${h}시간`
}

export function formatDate(date?: string | null, weekday?: string | null) {
  if (!date) return null
  const [, m, d] = date.split("-")
  return `${Number(m)}월 ${Number(d)}일${weekday ? ` (${weekday})` : ""}`
}

export function todayText(offsetDays = 0) {
  const now = new Date(Date.now() + 9 * 3600 * 1000 + offsetDays * 86400 * 1000)
  return now.toISOString().slice(0, 10)
}

// ---------- API ----------

async function readJson(response: Response) {
  const body = await response.json().catch(() => null)
  if (!response.ok || !body?.success) throw new Error(body?.message || "요청을 처리하지 못했어요.")
  return body.data
}

function post(path: string, body: unknown) {
  return fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Request-Id": crypto.randomUUID() },
    body: JSON.stringify(body),
  })
}

export async function fetchDestinations(
  { region, query, theme }: { region?: string; query?: string; theme?: string },
  signal?: AbortSignal,
): Promise<Destination[]> {
  const params = new URLSearchParams({ limit: "40" })
  if (region) params.set("region", region)
  if (query) params.set("q", query)
  if (theme) params.set("theme", theme)
  return readJson(await fetch(`${API_BASE_URL}/api/planner/destinations?${params}`, { signal, cache: "no-store" }))
}

export async function fetchDestinationsByIds(ids: number[], signal?: AbortSignal): Promise<Destination[]> {
  const params = new URLSearchParams({ ids: ids.join(",") })
  return readJson(await fetch(`${API_BASE_URL}/api/planner/destinations?${params}`, { signal, cache: "no-store" }))
}

// 다른 화면(순위 등)에서 플래너로 여행지를 넘길 때 쓰는 자리. 플래너가 열리면서 담은 목록에 더한다.
export const PLANNER_ADD_STORAGE_KEY = "stay-sync.planner.add"

export async function requestItinerary(body: {
  sessionId: string
  attractionIds?: number[]
  days?: number
  startDate?: string | null
  startLocation?: StartLocation | null
  accommodation?: StartLocation | null
  companion?: Companion | null
  dayGroups?: number[][]
}): Promise<Itinerary> {
  return readJson(await post("/api/planner/itinerary", body))
}

export async function askAssistant(body: {
  sessionId: string
  message: string
  context: { selectedIds: number[]; days: number; region?: string | null; companion?: Companion | null }
}): Promise<AssistResult> {
  return readJson(await post("/api/planner/assist", body))
}

export async function saveTrip(body: { sessionId: string; itinerary: Itinerary }): Promise<{ shareId: string; title: string }> {
  return readJson(await post("/api/planner/trips", body))
}

export async function fetchTrip(shareId: string): Promise<{ shareId: string; title: string; createdAt: string; itinerary: Itinerary } | null> {
  const response = await fetch(`${API_BASE_URL}/api/planner/trips/${encodeURIComponent(shareId)}`, { cache: "no-store" })
  if (response.status === 404) return null
  return readJson(response)
}

export async function fetchTrips(shareIds: string[]): Promise<SavedTripSummary[]> {
  if (shareIds.length === 0) return []
  return readJson(await fetch(`${API_BASE_URL}/api/planner/trips?ids=${shareIds.map(encodeURIComponent).join(",")}`, { cache: "no-store" }))
}

// 동행자 유형 — 챗봇과 같은 분류. 고르면 여행 이야기와 머무는 시간(아이·부모님은 여유 있게)에 반영된다.
export const COMPANIONS = [
  { id: "혼자", label: "혼자" },
  { id: "연인", label: "연인" },
  { id: "친구", label: "친구" },
  { id: "가족", label: "가족" },
  { id: "부모님", label: "부모님" },
  { id: "아이동반", label: "아이 동반" },
] as const
export type Companion = (typeof COMPANIONS)[number]["id"]

// 동행자별로 잘 맞는 관광 테마 (백엔드 themeOntology와 같다) — 목록에서 "추천" 표시에 쓴다.
export const COMPANION_THEMES: Record<Companion, string[]> = {
  혼자: ["자연관광", "문화관광"],
  연인: ["문화관광", "레저스포츠"],
  친구: ["레저스포츠", "문화관광"],
  가족: ["자연관광", "문화관광", "체험관광"],
  부모님: ["자연관광", "역사관광", "문화관광"],
  아이동반: ["체험관광", "자연관광", "문화관광"],
}

export function companionLabel(id: Companion | null | undefined) {
  return COMPANIONS.find((c) => c.id === id)?.label ?? null
}

// 숙소 검색 — 카카오 장소 검색에서 숙박 업소만 추린다.
export async function searchAccommodations(query: string, signal?: AbortSignal): Promise<StartLocation[]> {
  const response = await fetch(`${API_BASE_URL}/api/chat/locations/autocomplete?type=accommodation&q=${encodeURIComponent(query)}`, { signal })
  const data = (await readJson(response)) as { name: string; address?: string; latitude: number; longitude: number }[]
  return data
    .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
    .map((item) => ({ name: item.name, address: item.address ?? null, mapx: item.longitude, mapy: item.latitude }))
}

export async function searchStartLocations(query: string, signal?: AbortSignal): Promise<StartLocation[]> {
  const response = await fetch(`${API_BASE_URL}/api/chat/locations/autocomplete?q=${encodeURIComponent(query)}`, { signal })
  const data = (await readJson(response)) as { name: string; address?: string; latitude: number; longitude: number }[]
  return data
    .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
    .map((item) => ({ name: item.name, address: item.address ?? null, mapx: item.longitude, mapy: item.latitude }))
}

// 상세 서랍에서 쓰는 기존 관광지 API (소개글·월별 검색량 / 이용 안내·사진·주변 장소)
export type AttractionExtraInfo = {
  description: string | null
  address: string | null
  monthly: { month: number; searchCount: number; rank: number | null }[]
  intro: { label: string; value: string }[]
  info: { label: string; value: string }[]
  images: string[]
  homepage: string | null
  tel: string | null
  nearby: { id: number; title: string; region: string; type: string | null; image: string | null; mapx: number; mapy: number; distanceKm: number }[]
}

export async function fetchAttractionInfo(id: number, signal?: AbortSignal): Promise<AttractionExtraInfo> {
  const [trend, detail] = await Promise.all([
    fetch(`${API_BASE_URL}/api/attractions/${id}/trend?year=2025`, { signal }).then(readJson).catch(() => null),
    fetch(`${API_BASE_URL}/api/attractions/${id}/detail`, { signal }).then(readJson).catch(() => null),
  ])
  return {
    description: trend?.attraction?.description ?? null,
    address: trend?.attraction?.address ?? null,
    monthly: trend?.monthly ?? [],
    intro: detail?.intro ?? [],
    info: detail?.info ?? [],
    images: detail?.images ?? [],
    homepage: detail?.homepage ?? null,
    tel: detail?.tel ?? null,
    nearby: detail?.nearby?.attractions ?? [],
  }
}

// ---------- 저장한 여행 (로그인 없이 이 브라우저에 공유 ID만 보관) ----------

const SAVED_TRIPS_KEY = "stay-sync.saved-trips.v1"

export function loadSavedTripIds(): string[] {
  try {
    const ids = JSON.parse(window.localStorage.getItem(SAVED_TRIPS_KEY) || "[]")
    return Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : []
  } catch {
    return []
  }
}

export function rememberSavedTrip(shareId: string) {
  try {
    const ids = [shareId, ...loadSavedTripIds().filter((id) => id !== shareId)].slice(0, 50)
    window.localStorage.setItem(SAVED_TRIPS_KEY, JSON.stringify(ids))
  } catch {}
}

export function forgetSavedTrip(shareId: string) {
  try {
    window.localStorage.setItem(SAVED_TRIPS_KEY, JSON.stringify(loadSavedTripIds().filter((id) => id !== shareId)))
  } catch {}
}

// ---------- 챗봇 동선 결과 → 일정 형식 (기본 화면 챗봇이 사용) ----------

type RoutePoint = { id?: string | number; name: string; latitude?: number; longitude?: number; mapx?: number; mapy?: number }
type DailyRoute = {
  day: number
  origin?: RoutePoint | null
  stops: (RoutePoint & { fromPreviousKm?: number | null })[]
  totalDistanceKm?: number
}

function toPoint(point: RoutePoint): MapPoint | null {
  const lat = Number(point.latitude ?? point.mapy)
  const lng = Number(point.longitude ?? point.mapx)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const numericId = Number(point.id)
  return { id: Number.isInteger(numericId) ? numericId : null, name: point.name, lat, lng }
}

export function itineraryFromRoute(dailyRoutes: DailyRoute[], title = "추천 동선"): Itinerary | null {
  if (!Array.isArray(dailyRoutes) || dailyRoutes.length === 0) return null
  return {
    title,
    days: dailyRoutes.map((route) => {
      const origin = route.origin ? toPoint(route.origin) : null
      const stops = route.stops.map(toPoint).filter((p): p is MapPoint => p !== null)
      const distanceKm = Math.round(Number(route.totalDistanceKm || 0) * 10) / 10
      return {
        day: route.day,
        distanceKm,
        note: `${origin ? `${origin.name}에서 출발 · ` : ""}${stops.length}곳 · 차량 약 ${distanceKm}km`,
        stops: [...(origin ? [origin] : []), ...stops].map((p, i) => ({ ...p, id: typeof p.id === "number" ? p.id : -(i + 1) })),
      }
    }),
  }
}

// ---------- 담은 곳 미리보기 (직선거리 기준, 정확한 동선은 백엔드 도로망 계산) ----------

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (v: number) => (v * Math.PI) / 180
  const h =
    Math.sin(toRad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(toRad(b.lng - a.lng) / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/** 모든 지점을 출발점으로 시도해 가장 짧은 열린 경로를 고른다. */
export function optimizeRoute<T extends { id: number; lat: number; lng: number }>(stops: T[]) {
  if (stops.length <= 1) return { route: stops, totalKm: 0 }
  let best = { route: stops, total: Infinity }
  for (const start of stops) {
    const route = [start]
    const remaining = stops.filter((s) => s.id !== start.id)
    let total = 0
    while (remaining.length) {
      const last = route[route.length - 1]
      let bestIndex = 0
      remaining.forEach((d, i) => {
        if (distanceKm(last, d) < distanceKm(last, remaining[bestIndex])) bestIndex = i
      })
      total += distanceKm(last, remaining[bestIndex])
      route.push(remaining.splice(bestIndex, 1)[0])
    }
    if (total < best.total) best = { route, total }
  }
  return { route: best.route, totalKm: Math.round(best.total) }
}
