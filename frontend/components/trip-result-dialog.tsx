"use client"

import { useEffect, useRef } from "react"
import { ArrowUpRight, BedDouble, CalendarDays, Car, Check, CloudSun, Copy, Download, Home, Lightbulb, MapPin, Sparkles, Users, Utensils, X } from "lucide-react"
import { formatMinutes, type Itinerary } from "@/lib/planner"
import { parseStory } from "@/components/itinerary-reply"
import { useShareQr } from "@/components/planner/share-card"

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"]
const COMPANION_LABEL: Record<string, string> = { 아이동반: "아이와 함께" }

// 받침에 맞춰 "으로/로"를 붙인다 (받침 없음·ㄹ받침 → 로)
function withRo(word: string) {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  if (code < 0 || code > 11171) return `${word}(으)로`
  const jong = code % 28
  return `${word}${jong === 0 || jong === 8 ? "로" : "으로"}`
}

function md(date?: string | null) {
  if (!date) return null
  const d = new Date(`${date}T00:00:00Z`)
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${WEEKDAYS[d.getUTCDay()]})`
}

/**
 * 챗봇으로 완성한 여행 일정을 크게 보여 주는 결과 창 — 표지 사진, 날짜별 동선(사진·도착 시간·이동), 여행 이야기, 준비 팁,
 * 그리고 오른쪽에 휴대폰으로 가져가는 QR. 사이트 디자인(흰 바탕·세리프 제목·초록 강조)을 그대로 쓴다.
 */
export function TripResultDialog({
  itinerary, url, heading = "여행 일정이 완성됐어요", onClose,
}: {
  itinerary: Itinerary
  url: string
  heading?: string
  onClose: () => void
}) {
  const { svg, copied, copy, download } = useShareQr(url, itinerary.title)
  const closeRef = useRef<HTMLButtonElement>(null)
  const story = parseStory(itinerary.story ?? null)
  const stops = itinerary.days.flatMap((d) => d.stops)
  const cover = stops.find((s) => s.image)?.image
  const base = itinerary.accommodation?.name || itinerary.origin?.name
  const firstDay = itinerary.days[0]
  const lastDay = itinerary.days[itinerary.days.length - 1]

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[1250] flex items-center justify-center p-0 md:p-6" role="presentation">
      <div className="absolute inset-0 bg-foreground/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="trip-result-title"
        className="trip-result relative grid h-full w-full max-w-6xl grid-cols-1 overflow-hidden bg-background shadow-2xl md:h-[min(92dvh,900px)] md:grid-cols-[1fr_320px]"
      >
        {/* ---------- 왼쪽: 일정 ---------- */}
        <div className="min-h-0 overflow-y-auto">
          {/* 표지 */}
          <section className="relative h-[300px] overflow-hidden bg-primary text-white md:h-[340px]">
            {cover && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover} alt="" className="trip-cover-img absolute inset-0 size-full object-cover" />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/10 to-black/80" />
            <div className="absolute inset-x-8 bottom-7 flex flex-col gap-3">
              <p className="flex items-center gap-2 text-[12px] uppercase tracking-[0.04em] text-white/85"><Sparkles className="size-3.5" />{heading}</p>
              <h2 id="trip-result-title" className="font-serif text-[clamp(30px,3.2vw,46px)] leading-tight">{itinerary.title}</h2>
              <div className="flex flex-wrap gap-2 text-[13px]">
                {firstDay?.date && <Chip icon={<CalendarDays className="size-3.5" />}>{md(firstDay.date)}{lastDay?.date && lastDay.date !== firstDay.date ? ` – ${md(lastDay.date)}` : ""}</Chip>}
                <Chip icon={<MapPin className="size-3.5" />}>{stops.length}곳</Chip>
                {itinerary.totalKm ? <Chip icon={<Car className="size-3.5" />}>{itinerary.totalKm}km{itinerary.totalDriveMinutes ? ` · 운전 ${formatMinutes(itinerary.totalDriveMinutes)}` : ""}</Chip> : null}
                {itinerary.companion && <Chip icon={<Users className="size-3.5" />}>{COMPANION_LABEL[itinerary.companion] ?? itinerary.companion} 여행</Chip>}
                {base && <Chip icon={<BedDouble className="size-3.5" />}>{base}</Chip>}
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-10 px-8 py-9">
            {/* 여행 이야기 */}
            {(story?.headline || story?.intro) && (
              <section className="flex flex-col gap-3">
                <p className="text-[12px] uppercase tracking-[0.3em] text-accent">Travel story</p>
                {story?.headline && <h3 className="font-serif text-2xl leading-snug">{story.headline}</h3>}
                {story?.intro && <p className="max-w-3xl text-[15px] leading-7 text-foreground/80">{story.intro}</p>}
              </section>
            )}

            {/* 날짜별 동선 */}
            {itinerary.days.map((d) => (
              <section key={d.day} className="flex flex-col gap-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-3">
                  <p className="flex items-baseline gap-3">
                    <span className="text-[12px] uppercase tracking-[0.3em] text-accent">Day {d.day}</span>
                    {d.date && <span className="font-serif text-xl">{md(d.date)}</span>}
                  </p>
                  <p className="flex items-center gap-3 text-[13px] text-muted-foreground">
                    {d.weather?.maxTemp != null && <span className="inline-flex items-center gap-1"><CloudSun className="size-4" />{d.weather.minTemp ?? "-"}~{d.weather.maxTemp}°{d.weather.rainProb ? ` · 강수 ${d.weather.rainProb}%` : ""}</span>}
                    {d.startTime && d.endTime && <span>{d.startTime}–{d.endTime}</span>}
                    {d.distanceKm ? <span>{d.distanceKm}km</span> : null}
                  </p>
                </div>

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
                  <ol className="flex flex-col">
                    {d.startName && (
                      <TimelineRow time={d.startTime} icon={<Home className="size-3.5" />} muted>
                        <span className="text-sm">{d.startName}에서 출발</span>
                      </TimelineRow>
                    )}
                    {d.stops.map((s, i) => (
                      <li key={`${s.id}-${i}`} className="contents">
                        {(i > 0 || d.startName) && (s.driveMinutes || s.fromPreviousKm != null) ? (
                          <Leg>{`차량 ${s.driveMinutes ? formatMinutes(s.driveMinutes) : ""}${s.fromPreviousKm != null ? ` · ${s.fromPreviousKm}km` : ""}`}</Leg>
                        ) : null}
                        {s.lunchBefore && (
                          <TimelineRow icon={<Utensils className="size-3.5" />} muted>
                            <span className="text-sm text-muted-foreground">점심 · 약 1시간</span>
                          </TimelineRow>
                        )}
                        <TimelineRow time={s.arrive} number={i + 1}>
                          <div className="flex items-center gap-4">
                            <div className="relative h-16 w-24 shrink-0 overflow-hidden bg-muted">
                              {s.image && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={s.image} alt="" className="size-full object-cover" loading="lazy" />
                              )}
                            </div>
                            <div className="flex min-w-0 flex-col gap-0.5">
                              <span className="font-serif text-[17px] leading-snug">{s.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {[s.tag, s.arrive && s.depart ? `${s.arrive}–${s.depart}` : null, s.stayMinutes ? `${formatMinutes(s.stayMinutes)} 머무름` : null].filter(Boolean).join(" · ")}
                              </span>
                            </div>
                          </div>
                        </TimelineRow>
                      </li>
                    ))}
                    {d.returnToOrigin && d.endName && (
                      <>
                        {d.returnKm ? <Leg>{`차량 · ${d.returnKm}km`}</Leg> : null}
                        <TimelineRow time={d.endTime} icon={d.endKind === "stay" ? <BedDouble className="size-3.5" /> : <Home className="size-3.5" />} muted last>
                          <span className="text-sm">{d.endKind === "stay" ? `${d.endName}에서 숙박` : `${withRo(d.endName)} 복귀`}</span>
                        </TimelineRow>
                      </>
                    )}
                  </ol>
                  {story?.days.get(d.day) && (
                    <p className="self-start border-l-2 border-accent pl-4 text-[14px] leading-7 text-foreground/80">{story.days.get(d.day)}</p>
                  )}
                </div>

              </section>
            ))}

            {story?.tips && (
              <section className="flex gap-3 bg-accent/10 px-5 py-4">
                <Lightbulb className="mt-1 size-4 shrink-0 text-accent" />
                <div className="flex flex-col gap-1">
                  <p className="text-[12px] uppercase tracking-[0.04em] text-accent">여행 준비 팁</p>
                  <p className="text-[14px] leading-7 text-foreground/80">{story.tips}</p>
                </div>
              </section>
            )}
          </div>
        </div>

        {/* ---------- 오른쪽: QR ---------- */}
        <aside className="flex flex-col items-center justify-between gap-6 border-t border-border bg-muted/40 px-7 py-8 text-center md:border-t-0 md:border-l">
          <button ref={closeRef} type="button" onClick={onClose} aria-label="닫기"
            className="absolute right-4 top-4 z-10 grid size-10 place-items-center rounded-full bg-background/90 text-foreground shadow md:bg-transparent md:shadow-none">
            <X className="size-5" />
          </button>
          <div className="flex w-full flex-col items-center gap-5 pt-6">
            <p className="text-[12px] uppercase tracking-[0.3em] text-muted-foreground">Take it with you</p>
            <p className="font-serif text-xl leading-snug">휴대폰 카메라로 찍으면<br />일정이 바로 열려요</p>
            <div className="w-full max-w-[240px] border border-border bg-white p-3">
              <div className="aspect-square [&>svg]:size-full" role="img" aria-label="일정 QR 코드" dangerouslySetInnerHTML={svg ? { __html: svg } : undefined} />
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">지도·시간표·날씨·여행 이야기까지<br />그대로 · 친구에게 공유도 돼요</p>
            <div className="grid w-full grid-cols-2 gap-2">
              <button type="button" onClick={copy} className="inline-flex h-10 items-center justify-center gap-1.5 bg-primary text-[13px] text-primary-foreground">
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}{copied ? "복사했어요" : "링크 복사"}
              </button>
              <button type="button" onClick={download} className="inline-flex h-10 items-center justify-center gap-1.5 border border-border bg-background text-[13px]">
                <Download className="size-4" />QR 저장
              </button>
            </div>
          </div>
          {itinerary.kakaoRouteLinks && itinerary.kakaoRouteLinks.length > 0 && (
            <div className="flex w-full flex-col gap-2">
              <p className="text-[12px] uppercase tracking-[0.04em] text-muted-foreground">카카오맵 길찾기</p>
              {itinerary.kakaoRouteLinks.map((l) => (
                <a key={`${l.day}-${l.part}`} href={l.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex h-10 items-center justify-between border border-accent px-3 text-[13px] text-accent transition-colors hover:bg-accent hover:text-accent-foreground">
                  {l.day}일 차 경로 열기{l.part > 1 ? ` (${l.part})` : ""}<ArrowUpRight className="size-4" />
                </a>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

function Chip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 backdrop-blur-md">{icon}{children}</span>
}

function TimelineRow({
  time, number, icon, muted = false, last = false, children,
}: {
  time?: string | null
  number?: number
  icon?: React.ReactNode
  muted?: boolean
  last?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[3.25rem_1.75rem_1fr] items-center gap-3 py-1.5">
      <span className="text-right font-serif text-xs tabular-nums text-muted-foreground">{time ?? ""}</span>
      <span className={"relative z-10 flex size-7 items-center justify-center rounded-full text-[12px] font-bold " +
        (number ? "bg-accent text-accent-foreground" : "border border-border bg-background text-muted-foreground")}>
        {number ?? icon}
      </span>
      <div className={muted ? "text-muted-foreground" : ""} data-last={last || undefined}>{children}</div>
    </div>
  )
}

function Leg({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[3.25rem_1.75rem_1fr] items-center gap-3">
      <span />
      <span className="mx-auto h-7 w-px bg-border" aria-hidden />
      <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground"><Car className="size-3" />{children}</span>
    </div>
  )
}
