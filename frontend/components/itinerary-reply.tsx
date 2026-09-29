"use client"

import { useState } from "react"
import { ArrowUpRight, ChevronDown, Home, Lightbulb } from "lucide-react"
import type { ChatPlan, ChatRoute, KakaoRouteLink } from "@/lib/concierge-chat"
import { cn } from "@/lib/utils"

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"]

function formatDay(date?: string | null) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const d = new Date(`${date}T00:00:00Z`)
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${WEEKDAYS[d.getUTCDay()]})`
}

function km(value?: number | null) {
  return value == null || !Number.isFinite(Number(value)) ? null : `${Math.round(Number(value) * 10) / 10}km`
}

type ParsedStory = { headline: string | null; intro: string; days: Map<number, string>; tips: string | null }

// 여행 이야기(글)를 제목 · 소개 · 날짜별 이야기 · 준비 팁으로 나눈다. 형식이 다르면 null.
function parseStory(story: string | null): ParsedStory | null {
  if (!story) return null
  const lines = story.split("\n").map((line) => line.trim())
  const dayHeader = /^(?:(\d+)\s*일\s*차|day\s*(\d+))(?=\s|\(|:|$)/i
  const tipHeader = /^(여행\s*준비\s*팁|여행\s*팁|준비\s*팁|travel\s*tips?|tips)\s*:?$/i
  let headline: string | null = null
  const intro: string[] = []
  const days = new Map<number, string[]>()
  const tips: string[] = []
  let section: "intro" | "day" | "tips" = "intro"
  let currentDay = 0
  for (const line of lines) {
    const dayMatch = line.match(dayHeader)
    if (dayMatch) {
      section = "day"
      currentDay = Number(dayMatch[1] || dayMatch[2])
      days.set(currentDay, [])
      // "1일차 (2026-10-01) 본문…"처럼 한 줄에 이어 쓴 경우 본문만 남긴다.
      const rest = line.replace(dayHeader, "").replace(/^\s*\([^)]*\)\s*:?\s*/, "").trim()
      if (rest) days.get(currentDay)!.push(rest)
      continue
    }
    if (tipHeader.test(line)) {
      section = "tips"
      continue
    }
    if (!line) continue
    if (section === "intro") {
      if (headline === null) headline = line
      else intro.push(line)
    } else if (section === "day") days.get(currentDay)!.push(line)
    else tips.push(line)
  }
  if (days.size === 0) return null
  return {
    headline,
    intro: intro.join(" "),
    days: new Map([...days].map(([day, text]) => [day, text.join(" ")])),
    tips: tips.length ? tips.join(" ") : null,
  }
}

function DayRoute({ route }: { route: ChatRoute }) {
  const items: { kind: "start" | "stop" | "end"; name: string; km: string | null; order?: number }[] = []
  if (route.origin) items.push({ kind: "start", name: route.origin.name, km: null })
  route.stops.forEach((stop, index) =>
    items.push({ kind: "stop", name: stop.name, km: index === 0 && !route.origin ? null : km(stop.fromPreviousKm), order: index + 1 }),
  )
  if (route.returnToOrigin && route.origin) items.push({ kind: "end", name: route.origin.name, km: km(route.returnDistanceKm) })

  return (
    <ol className="flex flex-col">
      {items.map((item, index) => (
        <li key={`${item.kind}-${index}`} className="flex flex-col">
          {index > 0 && (
            <div className="flex items-center gap-3">
              <span className="flex w-6 justify-center" aria-hidden>
                <span className="h-5 w-px bg-border" />
              </span>
              {item.km && <span className="text-[11px] tabular-nums text-muted-foreground">{item.km}</span>}
            </div>
          )}
          <div className="flex items-center gap-3">
            {item.kind === "stop" ? (
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent font-serif text-[11px] text-accent-foreground">
                {item.order}
              </span>
            ) : (
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-foreground/30 text-muted-foreground">
                <Home className="size-3" aria-hidden />
              </span>
            )}
            <span className={cn("min-w-0 text-[13px] leading-snug", item.kind === "stop" ? "font-medium text-foreground" : "text-muted-foreground")}>
              {item.kind === "start" ? `${item.name} 출발` : item.kind === "end" ? `${item.name} 복귀` : item.name}
            </span>
          </div>
        </li>
      ))}
    </ol>
  )
}

function DayStory({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col gap-1.5">
      <p className={cn("text-[13px] leading-relaxed text-foreground/80", !open && "line-clamp-3")}>{text}</p>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex w-fit items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
      >
        {open ? "접기" : "이야기 더 보기"}
        <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
    </div>
  )
}

// 챗봇의 최종 여행 일정 답변 — 긴 글 대신 제목 · 날짜별 동선 · 이야기 · 팁으로 나눠 보여준다.
export function ItineraryReply({ plan, links }: { plan: ChatPlan; links?: KakaoRouteLink[] | null }) {
  const parsed = parseStory(plan.story)
  const totalKm = plan.routes.reduce((sum, route) => sum + Number(route.totalDistanceKm || 0), 0)
  const period = plan.routes.length > 1 ? `${plan.routes.length - 1}박 ${plan.routes.length}일` : "당일치기"
  const [showFullStory, setShowFullStory] = useState(false)

  return (
    <section className="overflow-hidden border border-border bg-background">
      <header className="flex flex-col gap-2 bg-muted/50 px-4 py-4">
        <p className="text-[10px] uppercase tracking-[0.28em] text-accent">
          {["Your Trip", plan.region, period].filter(Boolean).join(" · ")}
        </p>
        <h3 className="font-serif text-lg leading-snug">{parsed?.headline || `${plan.region ?? ""} ${period} 여행 일정`.trim()}</h3>
        {parsed?.intro && <p className="text-[13px] leading-relaxed text-muted-foreground">{parsed.intro}</p>}
        <p className="text-[11px] tabular-nums text-muted-foreground">
          {`${plan.routes.reduce((sum, route) => sum + route.stops.length, 0)}곳 · 총 이동 ${km(totalKm) ?? "-"}`}
        </p>
      </header>

      {plan.routes.map((route) => {
        const dayLinks = (links || []).filter((link) => link.day === route.day)
        const story = parsed?.days.get(route.day)
        return (
          <div key={route.day} className="flex flex-col gap-3 border-t border-border px-4 py-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="flex items-baseline gap-2">
                <span className="text-[10px] uppercase tracking-[0.28em] text-accent">{`Day ${route.day}`}</span>
                {formatDay(route.date) && <span className="font-serif text-[15px]">{formatDay(route.date)}</span>}
              </p>
              {km(route.totalDistanceKm) && <span className="text-[11px] tabular-nums text-muted-foreground">{km(route.totalDistanceKm)}</span>}
            </div>
            <DayRoute route={route} />
            {story && <DayStory text={story} />}
            {dayLinks.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {dayLinks.map((link) => (
                  <a
                    key={`${link.day}-${link.part}`}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 border border-accent px-3 py-1.5 text-xs text-accent transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    {`${link.day}일 차 카카오맵 열기${link.part > 1 ? ` (${link.part})` : ""}`}
                    <ArrowUpRight className="size-3.5" aria-hidden />
                  </a>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {parsed?.tips && (
        <div className="flex gap-3 border-t border-border bg-accent/5 px-4 py-4">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
          <div className="flex flex-col gap-1">
            <p className="text-[10px] uppercase tracking-[0.28em] text-accent">여행 준비 팁</p>
            <p className="text-[13px] leading-relaxed text-foreground/80">{parsed.tips}</p>
          </div>
        </div>
      )}

      {/* 이야기를 나누지 못한 형식이면 원문을 접어서 붙인다 */}
      {!parsed && plan.story && (
        <div className="flex flex-col gap-1.5 border-t border-border px-4 py-4">
          <p className={cn("whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/80", !showFullStory && "line-clamp-4")}>{plan.story}</p>
          <button type="button" onClick={() => setShowFullStory((v) => !v)} className="w-fit text-[11px] text-muted-foreground hover:text-foreground">
            {showFullStory ? "접기" : "여행 이야기 더 보기"}
          </button>
        </div>
      )}
    </section>
  )
}
