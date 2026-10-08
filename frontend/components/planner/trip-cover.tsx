"use client"

import { useEffect, useState } from "react"
import { CalendarDays, Car, Check, CloudSun, Link2, MapPin, Navigation, Pencil, Share2, Sparkles, Users } from "lucide-react"
import { formatMinutes, type Itinerary } from "@/lib/planner"
import { cn } from "@/lib/utils"
import { parseStory } from "@/components/itinerary-reply"

const COMPANION_LABEL: Record<string, string> = { 아이동반: "아이와 함께" }
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"]

function md(date?: string | null) {
  if (!date) return null
  const d = new Date(`${date}T00:00:00Z`)
  return { m: d.getUTCMonth() + 1, d: d.getUTCDate(), w: WEEKDAYS[d.getUTCDay()] }
}

/**
 * 공유 일정의 표지 — QR로 휴대폰에서 처음 열었을 때 "내 여행"처럼 느껴지게 한다.
 * 표지 사진 · 여행 티켓 · 가는 곳 사진 · 아래 고정 버튼(공유/길찾기/나도 만들기).
 */
export function TripCover({
  itinerary, shareId, fromKiosk, onPlanWithThis,
}: {
  itinerary: Itinerary
  shareId: string
  fromKiosk: boolean
  onPlanWithThis: () => void
}) {
  const stops = itinerary.days.flatMap((d) => d.stops.map((s) => ({ ...s, day: d.day })))
  const cover = stops.find((s) => s.image)?.image
  const region = stops[0]?.region || itinerary.title.split(" ")[0]
  const start = md(itinerary.startDate)
  const end = md(itinerary.endDate)
  const firstWeather = itinerary.days[0]?.weather
  const base = itinerary.accommodation?.name || itinerary.origin?.name
  const kakao = itinerary.kakaoRouteLinks?.find((l) => l.day === 1)?.url
  const [copied, setCopied] = useState(false)
  const story = parseStory(itinerary.story ?? null)
  const [welcome, setWelcome] = useState(fromKiosk)

  useEffect(() => {
    if (!fromKiosk) return
    const t = setTimeout(() => setWelcome(false), 6000)
    return () => clearTimeout(t)
  }, [fromKiosk])

  async function share() {
    const url = `${window.location.origin}/planner/trip/${shareId}`
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> }
    if (nav.share) {
      try { await nav.share({ title: itinerary.title, text: `${itinerary.title} — 경기북부 AI 여행 동선`, url }); return } catch { /* 취소 */ }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <>
      {/* ---------- 표지 ---------- */}
      <section className="relative -mx-5 -mt-8 overflow-hidden bg-primary text-white lg:-mx-10 lg:mt-0 lg:rounded-2xl">
        <div className="relative h-[62svh] min-h-[420px] max-h-[620px]">
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="trip-cover-img absolute inset-0 size-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/10 to-black/80" />
          <div className="absolute inset-x-5 top-5 flex items-center justify-between lg:inset-x-8">
            <span className="font-serif text-sm uppercase tracking-[0.35em] text-white/90">Stay-Sync</span>
            {fromKiosk && <span className="rounded-full bg-white/20 px-3 py-1 text-xs backdrop-blur">KINTEX 부스에서 만든 여행</span>}
          </div>
          <div className="absolute inset-x-5 bottom-8 flex flex-col gap-3 lg:inset-x-8">
            <p className="flex items-center gap-2 text-sm tracking-[0.04em] text-white/85"><Sparkles className="size-4" />AI가 만든 {region} 여행</p>
            <h1 className="font-serif text-[clamp(34px,9vw,60px)] leading-[1.1]">{itinerary.title}</h1>
            <div className="flex flex-wrap gap-2 text-sm">
              {start && <Pill icon={<CalendarDays className="size-4" />}>{start.m}월 {start.d}일{end && itinerary.endDate !== itinerary.startDate ? ` – ${end.m}월 ${end.d}일` : ""}</Pill>}
              <Pill icon={<MapPin className="size-4" />}>{stops.length}곳</Pill>
              {itinerary.totalKm ? <Pill icon={<Car className="size-4" />}>{itinerary.totalKm}km{itinerary.totalDriveMinutes ? ` · ${formatMinutes(itinerary.totalDriveMinutes)}` : ""}</Pill> : null}
              {itinerary.companion && <Pill icon={<Users className="size-4" />}>{COMPANION_LABEL[itinerary.companion] ?? itinerary.companion}</Pill>}
              {firstWeather?.maxTemp != null && <Pill icon={<CloudSun className="size-4" />}>{firstWeather.minTemp ?? "-"}~{firstWeather.maxTemp}°</Pill>}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- 여행 티켓 ---------- */}
      <section className="trip-ticket relative -mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 pt-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">From</p>
            <p className="mt-1 truncate font-serif text-xl">{base || stops[0]?.name}</p>
          </div>
          <div className="flex items-center gap-1 text-accent" aria-hidden>
            <span className="h-px w-6 bg-current" /><Car className="size-5" /><span className="h-px w-6 bg-current" />
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">To</p>
            <p className="mt-1 truncate font-serif text-xl">{region}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 px-5 py-4 text-sm">
          <TicketField label="Date">{start ? `${start.m}.${start.d} (${start.w})` : "-"}</TicketField>
          <TicketField label="Days">{itinerary.durationLabel || `${itinerary.days.length}일`}</TicketField>
          <TicketField label="Stops">{stops.length}곳</TicketField>
        </div>
        <div className="relative border-t border-dashed border-border px-5 py-4">
          <span className="absolute -left-3 -top-3 size-6 rounded-full bg-background" aria-hidden />
          <span className="absolute -right-3 -top-3 size-6 rounded-full bg-background" aria-hidden />
          <div className="flex items-end justify-between gap-4">
            <div className="trip-barcode h-10 flex-1" aria-hidden />
            <p className="shrink-0 font-mono text-xs tracking-[0.2em] text-muted-foreground">#{shareId.toUpperCase()}</p>
          </div>
        </div>
      </section>

      {/* ---------- 여행 이야기 ---------- */}
      {itinerary.story && (
        <section className="flex flex-col gap-5" aria-labelledby="trip-story-title">
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-2 text-[12px] uppercase tracking-[0.28em] text-accent"><Sparkles className="size-3.5" />Travel story</p>
            <h2 id="trip-story-title" className="font-serif text-[26px] leading-snug">{story?.headline || "AI가 들려주는 여행 이야기"}</h2>
            {story?.intro && <p className="text-[15px] leading-relaxed text-foreground/80">{story.intro}</p>}
          </div>
          {story ? (
            <ol className="flex flex-col gap-4 border-l border-border pl-5">
              {[...story.days.entries()].map(([day, text]) => {
                const date = md(itinerary.days.find((d) => d.day === day)?.date)
                return (
                  <li key={day} className="relative flex flex-col gap-1.5">
                    <span className="absolute -left-[27px] top-1 size-3 rounded-full border-2 border-background bg-accent" aria-hidden />
                    <p className="text-[12px] uppercase tracking-[0.04em] text-muted-foreground">
                      Day {day}{date ? ` · ${date.m}월 ${date.d}일 (${date.w})` : ""}
                    </p>
                    <p className="text-[15px] leading-relaxed text-foreground/85">{text}</p>
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="whitespace-pre-line text-[15px] leading-relaxed text-foreground/85">{itinerary.story}</p>
          )}
          {story?.tips && (
            <div className="flex flex-col gap-1 rounded-2xl bg-accent/10 px-5 py-4">
              <p className="text-[12px] uppercase tracking-[0.04em] text-accent">여행 준비 팁</p>
              <p className="text-sm leading-relaxed text-foreground/80">{story.tips}</p>
            </div>
          )}
        </section>
      )}

      {/* ---------- 가는 곳 사진 ---------- */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-2xl">이번 여행에서 가는 곳</h2>
          <span className="text-xs text-muted-foreground">옆으로 넘겨 보세요 →</span>
        </div>
        <div className="scrollbar-none -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 lg:mx-0 lg:px-0">
          {stops.map((s, i) => (
            <figure key={`${s.id}-${i}`} className="trip-card relative w-[62%] shrink-0 snap-start overflow-hidden rounded-2xl bg-muted sm:w-[40%] lg:w-[30%]">
              <div className="aspect-[3/4]">
                {s.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.image} alt="" className="size-full object-cover" loading="lazy" />
                )}
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
              <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-black">DAY {s.day} · {i + 1}</span>
              <figcaption className="absolute inset-x-3 bottom-3 text-white">
                <p className="font-serif text-lg leading-snug">{s.name}</p>
                {s.arrive && <p className="text-xs text-white/80">{s.arrive} 도착 · {s.tag}</p>}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ---------- 아래 고정 버튼 (휴대폰) ---------- */}
      <div className="h-20 lg:hidden" aria-hidden />
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur lg:hidden" aria-label="일정 바로가기">
        <div className="grid grid-cols-3 gap-2">
          <BarButton onClick={share} icon={copied ? <Check className="size-5" /> : <Share2 className="size-5" />}>{copied ? "복사됨" : "공유하기"}</BarButton>
          {kakao ? (
            <a href={kakao} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 rounded-xl py-2 text-xs">
              <Navigation className="size-5" />길찾기
            </a>
          ) : (
            <BarButton onClick={share} icon={<Link2 className="size-5" />}>링크</BarButton>
          )}
          <button type="button" onClick={onPlanWithThis} className="flex flex-col items-center gap-1 rounded-xl bg-primary py-2 text-xs text-primary-foreground">
            <Pencil className="size-5" />나도 만들기
          </button>
        </div>
      </nav>

      {/* ---------- 키오스크에서 왔을 때 환영 ---------- */}
      <div className={cn("pointer-events-none fixed inset-x-4 top-4 z-50 rounded-2xl bg-foreground px-5 py-4 text-background shadow-2xl transition-all duration-500",
        welcome ? "translate-y-0 opacity-100" : "-translate-y-6 opacity-0")} role="status">
        <p className="font-serif text-lg">여행 일정이 휴대폰에 도착했어요!</p>
        <p className="text-sm opacity-80">아래로 내리면 시간표·지도·날씨가 있어요. 공유도 할 수 있어요.</p>
      </div>
    </>
  )
}

function Pill({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 backdrop-blur-md">{icon}{children}</span>
}

function TicketField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{children}</p>
    </div>
  )
}

function BarButton({ onClick, icon, children }: { onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1 rounded-xl py-2 text-xs">
      {icon}{children}
    </button>
  )
}
