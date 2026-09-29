// 경기북부 관광 데이터 — 실제 백엔드(/api/rankings, /api/attractions)에서 검색량 데이터를 가져온다.
// UI는 월을 0-based(monthIndex, 0 = 1월)로 다루고, API 호출 시에만 1-based month로 변환한다.

export type Region = {
  id: string
  name: string
  tagline: string
}

export const DATA_YEAR = 2025

export const regions: Region[] = [
  { id: "gapyeong", name: "가평", tagline: "북한강이 흐르는 호반의 도시" },
  { id: "goyang", name: "고양", tagline: "호수공원과 꽃의 도시" },
  { id: "guri", name: "구리", tagline: "한강과 능선이 만나는 곳" },
  { id: "namyangju", name: "남양주", tagline: "물과 숲이 어우러진 정원 도시" },
  { id: "dongducheon", name: "동두천", tagline: "소요산 단풍의 고장" },
  { id: "yangju", name: "양주", tagline: "예술과 자연이 흐르는 도시" },
  { id: "yeoncheon", name: "연천", tagline: "임진강과 주상절리의 땅" },
  { id: "uijeongbu", name: "의정부", tagline: "미식과 문화의 중심 도시" },
  { id: "paju", name: "파주", tagline: "책과 평화가 머무는 접경 도시" },
  { id: "pocheon", name: "포천", tagline: "산정호수와 화강암의 고장" },
]

export const months = [
  "1월",
  "2월",
  "3월",
  "4월",
  "5월",
  "6월",
  "7월",
  "8월",
  "9월",
  "10월",
  "11월",
  "12월",
] as const

export function getRegion(regionId: string): Region | undefined {
  return regions.find((r) => r.id === regionId)
}

export type Category = { middle: string | null; small: string | null }

// 소분류 키워드가 더 구체적이라 먼저 보고, 없으면 중분류로 일러스트를 고른다.
const SMALL_CATEGORY_ILLUSTRATION: [RegExp, string][] = [
  [/하천|해양|호수|강|섬/, "/images/lake.png"],
  [/수목원|정원|공원|식물/, "/images/garden.png"],
  [/계곡|폭포|휴양림/, "/images/valley.png"],
  [/산|등산|전망/, "/images/mountain.png"],
  [/축제|공연|행사|테마/, "/images/festival.png"],
  [/쇼핑|시장|아울렛/, "/images/shopping.png"],
  [/역사|유적|사찰|안보|궁|능/, "/images/history.png"],
]

const MIDDLE_CATEGORY_ILLUSTRATION: Record<string, string> = {
  문화관광: "/images/culture.png",
  레저스포츠: "/images/mountain.png",
  역사관광: "/images/history.png",
  체험관광: "/images/festival.png",
  자연관광: "/images/valley.png",
  기타관광: "/images/culture.png",
  쇼핑: "/images/shopping.png",
}

export function categoryImageFor(category?: Category | null): string {
  const small = category?.small ?? ""
  const match = SMALL_CATEGORY_ILLUSTRATION.find(([pattern]) => pattern.test(small))
  if (match) return match[1]
  return MIDDLE_CATEGORY_ILLUSTRATION[category?.middle ?? ""] || "/images/culture.png"
}

export function categoryLabelFor(category?: Category | null): string {
  return category?.middle || "기타관광"
}

// 서버 렌더링은 같은 도커 네트워크의 백엔드로 바로 요청하고(API_INTERNAL_URL), 브라우저는 공개 도메인을 쓴다.
const API_BASE_URL = (
  (typeof window === "undefined" && process.env.API_INTERNAL_URL) ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:4500"
).replace(/\/$/, "")

export type Attraction = {
  id: number
  title: string
  titleEn: string | null
  address: string
  image: string | null
  indoorOutdoor: string | null
  mapx: number | null
  mapy: number | null
  // 한국관광공사 TourAPI 공식 소개글 (상세 조회에서만 채워진다)
  description?: string | null
}

type RawRankedItem = {
  position: number
  rank: number
  name: string
  searchCount: number
  category: Category
  attraction: Attraction | null
  // 관광지 마스터와 매칭되지 않아도 이름으로 검색해 찾은 이미지가 있을 수 있다.
  image?: string | null
}

export type RankedAttraction = {
  key: string
  rank: number
  name: string
  searches: number
  trend: number // 전월 대비 순위 변화 (양수 = 상승)
  category: Category
  // 관광지 DB와 매칭된 경우에만 상세 페이지가 있다.
  attractionId: number | null
  photo: string | null
}

function itemKey(item: RawRankedItem) {
  return item.attraction ? `id:${item.attraction.id}` : `name:${item.name}`
}

function toRanked(item: RawRankedItem, trend: number): RankedAttraction {
  return {
    key: itemKey(item),
    rank: item.position,
    name: item.name,
    searches: item.searchCount,
    trend,
    category: item.category,
    attractionId: item.attraction?.id ?? null,
    photo: item.attraction?.image || item.image || null,
  }
}

// 실제 사진이 있으면 사진, 없으면 카테고리 일러스트 (사진이 깨질 때의 대체 이미지는 categoryImageFor)
export function imageFor(item: { photo: string | null; category: Category }): string {
  return item.photo || categoryImageFor(item.category)
}

export type ViewMode = "tour" | "all"

// "관광지만" 보기에서 빼는 항목: 쇼핑, 교통시설, 체육시설, 골프장, 영화관 — 실제 검색량 상위를 차지하지만 관광 목적지가 아니다.
const NON_TOUR_SMALL_CATEGORIES = new Set(["교통시설", "레저스포츠시설"])
const NON_TOUR_NAME = /CC$|GC$|C\.C|G\.C|골프|컨트리클럽|CGV|메가박스|롯데시네마/i

export function isTourSpot(item: { name: string; category: Category }): boolean {
  if (item.category.middle === "쇼핑") return false
  if (NON_TOUR_SMALL_CATEGORIES.has(item.category.small ?? "")) return false
  return !NON_TOUR_NAME.test(item.name)
}

// 보기 모드에 맞게 걸러낸 뒤 순위를 다시 매기고, 같은 방식으로 걸러낸 전월 목록과 비교해 순위 변동을 다시 계산한다.
export function rerank<T extends RankedAttraction>(list: T[], previous: T[] | null, mode: ViewMode, limit = 20): T[] {
  const pick = (items: T[]) => (mode === "tour" ? items.filter(isTourSpot) : items)
  const previousRankByKey = new Map((previous ? pick(previous) : []).map((item, index) => [item.key, index + 1]))
  return pick(list)
    .slice(0, limit)
    .map((item, index) => {
      const previousRank = previousRankByKey.get(item.key)
      return { ...item, rank: index + 1, trend: previousRank ? previousRank - (index + 1) : 0 }
    })
}

export function attractionHref(regionId: string, attractionId: number | null, monthIndex: number): string | null {
  return attractionId ? `/attraction/${regionId}/${attractionId}?m=${monthIndex}` : null
}

async function fetchJson(path: string) {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store" })
    if (!res.ok) return null
    const body = await res.json()
    return body.success ? body.data : null
  } catch {
    return null
  }
}

async function fetchRankingRaw(regionName: string, year: number, month: number, limit = 20) {
  const params = new URLSearchParams({
    region: regionName,
    year: String(year),
    month: String(month),
    limit: String(limit),
  })
  const data = await fetchJson(`/api/rankings?${params.toString()}`)
  return (data?.items ?? []) as RawRankedItem[]
}

function attachTrend(current: RawRankedItem[], previous: RawRankedItem[]): RankedAttraction[] {
  const previousRankByKey = new Map(previous.map((item) => [itemKey(item), item.position]))
  return current.map((item) => {
    const previousPosition = previousRankByKey.get(itemKey(item))
    return toRanked(item, previousPosition ? previousPosition - item.position : 0)
  })
}

// 지역의 12개월치 순위를 한번에 가져온다 (달 전환 시 재요청 없이 즉시 반영하기 위함). 결과 index = monthIndex.
export async function getRankingsByYear(regionId: string, year: number = DATA_YEAR): Promise<RankedAttraction[][]> {
  const region = getRegion(regionId)
  if (!region) return []

  // 관광지만 걸러도 20곳이 남도록 넉넉히 받아 온다.
  const raw = await Promise.all(months.map((_, monthIndex) => fetchRankingRaw(region.name, year, monthIndex + 1, 40)))
  return raw.map((items, monthIndex) => attachTrend(items, monthIndex === 0 ? [] : raw[monthIndex - 1]))
}

// 지역별 해당 월 관광지 1위 (홈 지역 그리드용)
export async function getRegionLeaders(monthIndex: number, year: number = DATA_YEAR) {
  const leaders = await Promise.all(
    regions.map(async (region) => {
      const items = await fetchRankingRaw(region.name, year, monthIndex + 1, 15)
      const top = items.map((item) => toRanked(item, 0)).find(isTourSpot)
      return [region.id, top ?? null] as const
    }),
  )
  return Object.fromEntries(leaders) as Record<string, RankedAttraction | null>
}

export type RegionTopItem = RankedAttraction & { regionId: string; regionName: string }

// 전 지역을 통합한 해당 월 검색량 순 목록 (브라우저에서도 호출된다). 보기 모드 필터는 화면에서 적용하므로 자르지 않는다.
export async function getTopAcrossRegions(monthIndex: number, year: number = DATA_YEAR): Promise<RegionTopItem[]> {
  const perRegion = await Promise.all(
    regions.map(async (region) => {
      const items = await fetchRankingRaw(region.name, year, monthIndex + 1, 20)
      return items.map((item) => ({ ...toRanked(item, 0), regionId: region.id, regionName: region.name }))
    }),
  )

  return perRegion
    .flat()
    .sort((a, b) => b.searches - a.searches)
    .map((item, index) => ({ ...item, rank: index + 1 }))
}

export type MonthlyStat = { monthIndex: number; searches: number; rank: number | null }

export type AttractionStats = {
  regionId: string
  regionName: string
  attraction: Attraction
  category: Category | null
  monthly: MonthlyStat[]
}

// 특정 관광지의 12개월 검색량·순위 시계열 (실제 DB에 등록된 관광지에 한해 조회 가능)
export async function getAttractionStats(
  regionId: string,
  attractionId: number,
  year: number = DATA_YEAR,
): Promise<AttractionStats | null> {
  const region = getRegion(regionId)
  if (!region) return null

  const data = await fetchJson(`/api/attractions/${attractionId}/trend?year=${year}`)
  if (!data || data.attraction.region !== region.name) return null

  const byMonth = new Map<number, { rank: number | null; searchCount: number }>(
    data.monthly.map((m: { month: number; rank: number | null; searchCount: number }) => [m.month, m]),
  )

  return {
    regionId,
    regionName: region.name,
    attraction: data.attraction,
    category: data.category ?? null,
    monthly: months.map((_, monthIndex) => {
      const m = byMonth.get(monthIndex + 1)
      return { monthIndex, searches: m?.searchCount ?? 0, rank: m?.rank ?? null }
    }),
  }
}

export function parseMonth(value?: string): number {
  const n = Number(value)
  return value !== undefined && Number.isInteger(n) && n >= 0 && n < 12 ? n : new Date().getMonth()
}

export function formatCount(n: number): string {
  return n.toLocaleString("ko-KR")
}

export function getRegionByName(name: string): Region | undefined {
  return regions.find((r) => r.name === name)
}

export type InfoItem = { label: string; value: string }

export type NearbyPlace = {
  id: number
  title: string
  region: string
  type: string | null
  address: string | null
  image: string | null
  mapx: number | null
  mapy: number | null
  distanceKm: number
}

export type AttractionExtras = {
  contentType: string | null
  titleEn: string | null
  indoorOutdoor: string | null
  tel: string | null
  telName: string | null
  homepage: string | null
  zipCode: string | null
  // 관광공사 이용 안내(이용시간·쉬는 날·주차 등)와 반복 정보(입장료·화장실 등)
  intro: InfoItem[]
  info: InfoItem[]
  images: string[]
  location: { lat: number; lng: number } | null
  nearby: { attractions: NearbyPlace[]; restaurants: NearbyPlace[]; stays: NearbyPlace[] }
}

// 상세 페이지 부가 정보 (TourAPI 이용 안내·추가 사진, 주변 관광지·맛집·숙소)
export async function getAttractionExtras(attractionId: number): Promise<AttractionExtras | null> {
  return fetchJson(`/api/attractions/${attractionId}/detail`)
}

export function kakaoMapLink(name: string, lat: number, lng: number) {
  return `https://map.kakao.com/link/map/${encodeURIComponent(name)},${lat},${lng}`
}

export function kakaoDirectionsLink(name: string, lat: number, lng: number) {
  return `https://map.kakao.com/link/to/${encodeURIComponent(name)},${lat},${lng}`
}
