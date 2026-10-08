"use client"

import { ArrowUpRight, MapPin, Navigation } from "lucide-react"
import { cn } from "@/lib/utils"
import { DAY_COLORS, formatDate, type ItineraryDay, type MapPoint } from "@/lib/planner"
import { LazyMap } from "./lazy-map"

type RouteLink = { day: number; part: number; url: string }

// 카카오맵 웹(데스크톱)의 왼쪽 길찾기 패널 + 지도 왼쪽 세로 도구 모음 너비, 지도 위쪽 메뉴 줄 높이
const KAKAO_PANEL_WIDTH = 446
const KAKAO_TOOLBAR_HEIGHT = 64

// 일자별 동선을 카카오맵으로 보여 준다(실제 도로를 따라 그린 경로). 카카오맵 길찾기 화면에서 왼쪽 길찾기 패널과
// 위쪽 메뉴 줄은 보이는 영역 밖으로 밀어내 지도와 동선만 보이게 한다(다른 사이트 화면이라 모양을 직접 바꿀 수 없다).
// 카카오 길찾기는 한 번에 하루치 경로만 그리므로, 위에서 날짜(와 긴 경로의 구간)를 고른다.
// 카카오맵 웹은 좁은 화면에서 지도를 가리므로, 모바일은 간단한 지도 + "카카오맵으로 길찾기"(앱/모바일 웹) 버튼으로 보여 준다.
export function KakaoRouteMap({
  days,
  links,
  day,
  part,
  onSelect,
  origin = null,
  stale = false,
}: {
  days: ItineraryDay[]
  links: RouteLink[]
  day: number
  part: number
  onSelect: (day: number, part: number) => void
  origin?: MapPoint | null
  stale?: boolean
}) {
  const dayLinks = links.filter((l) => l.day === day).sort((a, b) => a.part - b.part)
  const current = dayLinks.find((l) => l.part === part) ?? dayLinks[0]
  const dayInfo = days.find((d) => d.day === day)
  const onlyStop = dayInfo && dayInfo.stops.length === 1 ? dayInfo.stops[0] : null
  const dayIndex = Math.max(0, days.findIndex((d) => d.day === day))

  return (
    <section aria-label="카카오맵 동선" className="flex flex-col overflow-hidden rounded-sm border border-border">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-2">
        <div role="tablist" aria-label="지도 날짜" className="scrollbar-none flex gap-1 overflow-x-auto">
          {days.map((d, i) => (
            <button
              key={d.day}
              type="button"
              role="tab"
              aria-selected={d.day === day}
              onClick={() => onSelect(d.day, 1)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-colors",
                d.day === day ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <span className="size-1.5 rounded-full" style={{ background: DAY_COLORS[i % DAY_COLORS.length] }} aria-hidden />
              {`${d.day}일 차${d.date ? ` · ${formatDate(d.date)}` : ""}`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {dayLinks.length > 1 &&
            dayLinks.map((l) => (
              <button
                key={l.part}
                type="button"
                onClick={() => onSelect(day, l.part)}
                aria-pressed={l.part === current?.part}
                className={cn(
                  "rounded-sm border px-2 py-0.5 text-[12px]",
                  l.part === current?.part ? "border-foreground text-foreground" : "border-border text-muted-foreground",
                )}
              >
                {`구간 ${l.part}`}
              </button>
            ))}
          {current && (
            <a
              href={current.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              카카오맵에서 크게 보기
              <ArrowUpRight className="size-3.5" aria-hidden />
            </a>
          )}
        </div>
      </div>

      {/* 모바일: 간단한 지도 + 카카오맵 열기 */}
      <div className="relative h-72 bg-muted md:hidden">
        {dayInfo && (
          <LazyMap
            routes={[{ points: dayInfo.stops, color: DAY_COLORS[dayIndex % DAY_COLORS.length] }]}
            origin={origin}
          />
        )}
        {current && (
          <a
            href={current.url}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-x-4 bottom-4 z-[500] inline-flex h-11 items-center justify-center gap-2 rounded-sm bg-primary text-sm text-primary-foreground shadow-lg"
          >
            <Navigation className="size-4" aria-hidden />
            {`${day}일 차 카카오맵으로 길찾기`}
          </a>
        )}
      </div>

      <div className="relative hidden h-[480px] overflow-hidden bg-muted md:block lg:h-[560px]">
        {current ? (
          <iframe
            key={current.url}
            title={`${day}일 차 카카오맵 동선`}
            src={current.url}
            loading="lazy"
            tabIndex={-1}
            className="absolute border-0"
            style={{
              left: -KAKAO_PANEL_WIDTH,
              top: -KAKAO_TOOLBAR_HEIGHT,
              width: `calc(100% + ${KAKAO_PANEL_WIDTH}px)`,
              height: `calc(100% + ${KAKAO_TOOLBAR_HEIGHT}px)`,
            }}
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
            <MapPin className="size-5" aria-hidden />
            {onlyStop ? (
              <>
                <p>{`이 날은 ${onlyStop.name} 한 곳에 머물러 이동 경로가 없어요.`}</p>
                <a
                  href={`https://map.kakao.com/link/map/${encodeURIComponent(onlyStop.name)},${onlyStop.lat},${onlyStop.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  카카오맵에서 위치 보기
                </a>
              </>
            ) : (
              <p>이 날의 카카오맵 경로가 없어요.</p>
            )}
          </div>
        )}
        {stale && (
          <p className="absolute inset-x-0 top-0 bg-accent px-4 py-2 text-center text-xs text-accent-foreground">
            바꾼 일정은 &lsquo;동선 다시 계산&rsquo; 후 지도에 반영돼요.
          </p>
        )}
      </div>
    </section>
  )
}
