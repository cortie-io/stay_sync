"use client"

import {
  ArrowUpRight,
  BedDouble,
  Car,
  CloudRain,
  Home,
  Loader2,
  QrCode,
  RefreshCw,
  Share2,
  Sun,
  Users,
  Utensils,
  X,
} from "lucide-react"
import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import {
  DAY_COLORS,
  companionLabel,
  formatDate,
  formatMinutes,
  type Itinerary,
  type ItineraryDay,
  type ItineraryStop,
} from "@/lib/planner"
import { SafeImage } from "@/components/safe-image"
import { KakaoRouteMap } from "./kakao-route-map"
import { ShareCard, ShareDialog } from "./share-card"

function sameGroups(a: number[][], b: number[][]) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function WeatherChip({ day }: { day: ItineraryDay }) {
  const w = day.weather
  if (!w) return null
  const rainy = (w.rainProb ?? 0) >= 60
  const Icon = rainy ? CloudRain : Sun
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]",
        w.indoorRecommended ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground",
      )}
      title={w.indoorRecommended ? `${w.reasons.join("·")} 예보 — 실내 여행지를 섞어 보세요` : undefined}
    >
      <Icon className="size-3" aria-hidden />
      {`${w.minTemp ?? "-"}~${w.maxTemp ?? "-"}° · 강수 ${w.rainProb ?? 0}%`}
      {w.indoorRecommended && " · 실내 권장"}
    </span>
  )
}

function Connector({ children, icon: Icon = Car }: { children: React.ReactNode; icon?: typeof Car }) {
  return (
    <li className="flex items-center gap-3 py-2 pl-[4.25rem] text-[11px] text-muted-foreground">
      <span className="-ml-[1.7rem] flex size-5 items-center justify-center rounded-full bg-muted">
        <Icon className="size-3" aria-hidden />
      </span>
      {children}
    </li>
  )
}

function StopRow({
  stop,
  index,
  color,
  showTimes,
  editable,
  dayCount,
  dayIndex,
  onMove,
  onRemove,
}: {
  stop: ItineraryStop
  index: number
  color: string
  showTimes: boolean
  editable: boolean
  dayCount: number
  dayIndex: number
  onMove: (toDay: number) => void
  onRemove: () => void
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="w-12 shrink-0 pt-1 text-right font-serif text-xs tabular-nums text-muted-foreground">
        {showTimes && stop.arrive ? stop.arrive : ""}
      </span>
      <span
        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full font-serif text-[11px] text-white"
        style={{ background: color }}
      >
        {index + 1}
      </span>
      <div className="flex min-w-0 flex-1 gap-3 rounded-sm border border-border p-2.5">
        <span className="relative size-14 shrink-0 overflow-hidden rounded-sm bg-muted">
          <SafeImage src={stop.image || "/placeholder.svg"} fallback="/placeholder.svg" alt="" fill sizes="56px" className="object-cover" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-serif text-[15px]">{stop.name}</span>
          <span className="truncate text-[11px] text-muted-foreground">
            {[stop.tag, stop.indoorOutdoor].filter(Boolean).join(" · ")}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {showTimes && stop.arrive && stop.depart
              ? `${stop.arrive}–${stop.depart} · 약 ${formatMinutes(stop.stayMinutes)} 머무름`
              : `약 ${formatMinutes(stop.stayMinutes ?? 90)} 머무름`}
          </span>
        </div>
        {editable && (
          <div className="flex shrink-0 flex-col items-end justify-between gap-1">
            <button
              type="button"
              onClick={onRemove}
              aria-label={`${stop.name} 일정에서 빼기`}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="size-4" aria-hidden />
            </button>
            {dayCount > 1 && (
              <label className="text-[11px] text-muted-foreground">
                <span className="sr-only">다른 날로 옮기기</span>
                <select
                  value={dayIndex}
                  onChange={(e) => onMove(Number(e.target.value))}
                  className="cursor-pointer bg-transparent text-right outline-none hover:text-foreground"
                >
                  {Array.from({ length: dayCount }, (_, d) => (
                    <option key={d} value={d}>{`${d + 1}일 차`}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}
      </div>
    </li>
  )
}

export function ItineraryView({
  itinerary,
  editable = true,
  recalculating = false,
  onRecalculate,
  onAddMore,
  onSave,
  saving = false,
  shareId = null,
  footer,
}: {
  itinerary: Itinerary
  editable?: boolean
  recalculating?: boolean
  onRecalculate?: (dayGroups: number[][]) => void
  onAddMore?: () => void
  onSave?: () => void
  saving?: boolean
  shareId?: string | null
  footer?: React.ReactNode
}) {
  const baseGroups = useMemo(
    () => itinerary.dayGroups ?? itinerary.days.map((d) => d.stops.map((s) => s.id)),
    [itinerary],
  )
  const [groups, setGroups] = useState<number[][]>(baseGroups)
  const [activeDay, setActiveDay] = useState(0) // 0 = 전체
  // 지도는 고른 날짜의 카카오맵 길찾기를 보여 준다. 아래 날짜 탭에서 특정 날을 고르면 지도도 그날로 바뀐다.
  const [mapView, setMapView] = useState({ day: 1, part: 1 })
  const [storyOpen, setStoryOpen] = useState(false)

  useEffect(() => {
    setGroups(baseGroups)
    setActiveDay(0)
    setMapView({ day: 1, part: 1 })
  }, [baseGroups])

  const stopById = useMemo(() => new Map(itinerary.days.flatMap((d) => d.stops.map((s) => [s.id, s] as const))), [itinerary])
  const dirty = !sameGroups(groups, baseGroups)
  const visibleGroups = groups.filter((g) => g.length > 0)

  // 편집 중에는 사용자가 바꾼 배치를 보여 주고, 계산된 시간·거리는 다시 계산 전까지 숨긴다.
  const days: ItineraryDay[] = dirty
    ? visibleGroups.map((ids, i) => ({
        day: i + 1,
        note: `${ids.length}곳`,
        date: itinerary.days[i]?.date,
        weekday: itinerary.days[i]?.weekday,
        weather: itinerary.days[i]?.weather,
        stops: ids.map((id) => stopById.get(id)).filter((s): s is ItineraryStop => !!s),
      }))
    : itinerary.days

  useEffect(() => {
    if (activeDay !== 0) setMapView({ day: activeDay, part: 1 })
  }, [activeDay])
  const stopCount = days.reduce((sum, d) => sum + d.stops.length, 0)

  function move(stopId: number, toDay: number) {
    setGroups((prev) => {
      const next = prev.map((g) => g.filter((id) => id !== stopId))
      while (next.length <= toDay) next.push([])
      next[toDay] = [...next[toDay], stopId]
      return next
    })
  }

  function remove(stopId: number) {
    setGroups((prev) => prev.map((g) => g.filter((id) => id !== stopId)))
  }

  // 서버 렌더와 어긋나지 않게 주소는 마운트 후에 만든다.
  const [siteOrigin, setSiteOrigin] = useState<string | null>(null)
  useEffect(() => setSiteOrigin(window.location.origin), [])
  const shareUrl = shareId && siteOrigin ? `${siteOrigin}/planner/trip/${shareId}` : null

  // 이 화면에서 "저장하고 공유하기"로 막 저장했을 때(shareId가 새로 생겼을 때)만 팝업을 띄운다.
  const [shareOpen, setShareOpen] = useState(false)
  const prevShareId = useRef(shareId)
  useEffect(() => {
    if (shareId && !prevShareId.current && onSave) setShareOpen(true)
    prevShareId.current = shareId
  }, [shareId, onSave])

  // 그날 출발하는 곳 / 하루를 마치는 곳. 예전에 저장한 일정(필드 없음)은 출발지를 쓴다.
  const dayStart = (d: ItineraryDay) => (d.startName !== undefined ? d.startName : itinerary.origin?.name ?? null)
  const dayEnd = (d: ItineraryDay) => d.endName ?? itinerary.origin?.name ?? null
  const isStay = (name: string | null) => Boolean(name && itinerary.accommodation && name === itinerary.accommodation.name)

  const dateRange = itinerary.startDate
    ? `${formatDate(itinerary.startDate, days[0]?.weekday)}${itinerary.endDate && itinerary.endDate !== itinerary.startDate ? ` – ${formatDate(itinerary.endDate)}` : ""}`
    : null

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">My Itinerary</p>
          <h1 className="text-balance font-serif text-3xl text-foreground">{itinerary.title}</h1>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {dateRange && <span className="text-foreground">{dateRange}</span>}
            <span>{`${stopCount}곳`}</span>
            {!dirty && itinerary.totalKm != null && <span>{`차량 이동 ${itinerary.totalKm}km`}</span>}
            {!dirty && itinerary.totalDriveMinutes ? <span>{`운전 약 ${formatMinutes(itinerary.totalDriveMinutes)}`}</span> : null}
            {itinerary.origin && (
              <span className="inline-flex items-center gap-1">
                <Home className="size-3.5" aria-hidden />
                {itinerary.origin.name}
              </span>
            )}
            {itinerary.accommodation && (
              <span className="inline-flex items-center gap-1">
                <BedDouble className="size-3.5" aria-hidden />
                {itinerary.accommodation.name}
              </span>
            )}
            {itinerary.companion && (
              <span className="inline-flex items-center gap-1">
                <Users className="size-3.5" aria-hidden />
                {`${companionLabel(itinerary.companion)} 여행`}
              </span>
            )}
          </p>
          {itinerary.estimated && !dirty && (
            <p className="text-[11px] text-muted-foreground">
              도로망 서버가 응답하지 않아 일부 거리·시간은 직선거리로 추정했어요.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editable && onAddMore && (
            <button
              type="button"
              onClick={onAddMore}
              className="inline-flex h-10 items-center gap-2 rounded-sm border border-border px-4 text-[13px] hover:border-foreground"
            >
              여행지 더 담기
            </button>
          )}
          {onSave &&
            (shareId ? (
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                className="inline-flex h-10 items-center gap-2 rounded-sm border border-accent px-4 text-[13px] text-accent hover:bg-accent/10"
              >
                <QrCode className="size-4" aria-hidden />
                QR·링크 공유
              </button>
            ) : (
              <button
                type="button"
                onClick={onSave}
                disabled={saving || dirty}
                className="inline-flex h-10 items-center gap-2 rounded-sm bg-primary px-5 text-[13px] text-primary-foreground hover:opacity-85 disabled:opacity-30"
              >
                {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Share2 className="size-4" aria-hidden />}
                저장하고 공유하기
              </button>
            ))}
        </div>
      </header>

      {dirty && editable && (
        <div className="flex flex-col gap-3 rounded-sm border border-accent bg-accent/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            일정을 바꿨어요. 순서·이동 시간은 <strong className="font-medium">동선 다시 계산</strong>을 누르면 반영돼요.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setGroups(baseGroups)} className="h-9 px-3 text-[13px] text-muted-foreground hover:text-foreground">
              되돌리기
            </button>
            <button
              type="button"
              disabled={recalculating || visibleGroups.length === 0}
              onClick={() => onRecalculate?.(visibleGroups)}
              className="inline-flex h-9 items-center gap-2 rounded-sm bg-primary px-4 text-[13px] text-primary-foreground disabled:opacity-40"
            >
              {recalculating ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
              동선 다시 계산
            </button>
          </div>
        </div>
      )}

      <KakaoRouteMap
        days={itinerary.days}
        links={itinerary.kakaoRouteLinks ?? []}
        day={mapView.day}
        part={mapView.part}
        onSelect={(day, part) => setMapView({ day, part })}
        origin={itinerary.origin ? { id: "origin", name: itinerary.origin.name, lat: itinerary.origin.lat, lng: itinerary.origin.lng } : null}
        stale={dirty}
      />

      <div role="tablist" aria-label="일자" className="scrollbar-none -mb-2 flex gap-5 overflow-x-auto border-b border-border">
        {[{ day: 0 } as Pick<ItineraryDay, "day"> & Partial<ItineraryDay>, ...days].map((d) => {
          const active = activeDay === d.day
          return (
            <button
              key={d.day}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveDay(d.day)}
              className={cn(
                "flex shrink-0 items-center gap-2 border-b-2 py-2.5 text-sm transition-colors",
                active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {d.day !== 0 && <span className="size-2 rounded-full" style={{ background: DAY_COLORS[(d.day - 1) % DAY_COLORS.length] }} />}
              {d.day === 0 ? "전체 일정" : `${d.day}일 차${d.date ? ` · ${formatDate(d.date, d.weekday)}` : ""}`}
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-10">
        {days
          .filter((d) => activeDay === 0 || d.day === activeDay)
          .map((d) => {
            const color = DAY_COLORS[(d.day - 1) % DAY_COLORS.length]
            const kakao = (itinerary.kakaoRouteLinks ?? []).filter((l) => l.day === d.day)
            const showTimes = !dirty
            return (
              <section key={d.day} aria-label={`${d.day}일 차`} className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[11px] uppercase tracking-[0.28em]" style={{ color }}>{`Day ${d.day}`}</span>
                    {d.date && <span className="font-serif text-lg">{formatDate(d.date, d.weekday)}</span>}
                    <WeatherChip day={d} />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {showTimes && d.startTime && d.endTime
                      ? `${d.startTime}–${d.endTime} · ${d.distanceKm}km · 운전 ${formatMinutes(d.driveMinutes)}${d.estimated ? " (추정)" : ""}`
                      : d.note}
                  </span>
                </div>
                {d.weather?.indoorRecommended && (
                  <p className="text-xs text-accent">비·폭염 등이 예보된 날이에요. 실내 여행지를 섞으면 더 편해요.</p>
                )}
                <ol className="flex flex-col gap-1.5">
                  {dayStart(d) && (
                    <li className="flex items-center gap-3">
                      <span className="w-12 shrink-0 text-right font-serif text-xs tabular-nums text-muted-foreground">
                        {showTimes ? d.startTime : ""}
                      </span>
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-sm border-2 border-foreground bg-background">
                        {isStay(dayStart(d)) ? <BedDouble className="size-3" aria-hidden /> : <Home className="size-3" aria-hidden />}
                      </span>
                      <span className="text-sm text-muted-foreground">{`${dayStart(d)}에서 출발`}</span>
                    </li>
                  )}
                  {d.stops.map((stop, i) => (
                    <Fragment key={stop.id}>
                      {showTimes && (i > 0 || dayStart(d)) && (stop.driveMinutes ?? 0) > 0 && (
                        <Connector>{`차량 약 ${formatMinutes(stop.driveMinutes)} · ${stop.fromPreviousKm ?? "-"}km`}</Connector>
                      )}
                      {showTimes && stop.lunchBefore && <Connector icon={Utensils}>점심 · 약 1시간</Connector>}
                      <StopRow
                        stop={stop}
                        index={i}
                        color={color}
                        showTimes={showTimes}
                        editable={editable && !!onRecalculate}
                        dayCount={Math.max(days.length, 1)}
                        dayIndex={d.day - 1}
                        onMove={(toDay) => move(stop.id, toDay)}
                        onRemove={() => remove(stop.id)}
                      />
                    </Fragment>
                  ))}
                  {showTimes && d.returnToOrigin && dayEnd(d) && (
                    <Connector icon={d.endKind === "stay" ? BedDouble : Home}>
                      {`${dayEnd(d)}${d.endKind === "stay" ? "(으)로 이동해 숙박" : "(으)로 복귀"}${d.returnKm ? ` · ${d.returnKm}km` : ""}`}
                    </Connector>
                  )}
                </ol>
                {showTimes && kakao.length > 0 && (
                  <div className="flex flex-wrap gap-2 pl-[4.25rem]">
                    {kakao.map((link) => (
                      <a
                        key={`${link.day}-${link.part}`}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 border border-border px-3 py-1.5 text-xs hover:border-foreground"
                      >
                        {`카카오맵 길찾기${link.part > 1 ? ` (${link.part})` : ""}`}
                        <ArrowUpRight className="size-3.5" aria-hidden />
                      </a>
                    ))}
                  </div>
                )}
              </section>
            )
          })}
      </div>

      {itinerary.story && (
        <section className="flex flex-col gap-3 border-t border-border pt-6">
          <h2 className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">여행 이야기</h2>
          <p className={cn("whitespace-pre-line text-sm leading-relaxed text-foreground/85", !storyOpen && "line-clamp-4")}>
            {itinerary.story}
          </p>
          <button type="button" onClick={() => setStoryOpen((v) => !v)} className="self-start text-xs text-muted-foreground underline underline-offset-4">
            {storyOpen ? "접기" : "더 읽기"}
          </button>
        </section>
      )}

      {shareUrl && <ShareCard url={shareUrl} title={itinerary.title} />}
      {shareOpen && shareUrl && <ShareDialog url={shareUrl} title={itinerary.title} onClose={() => setShareOpen(false)} />}
      {footer}
    </div>
  )
}
