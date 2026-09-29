"use client"

import { ArrowUpRight, Loader2 } from "lucide-react"
import { Fragment } from "react"
import { MAX_STOPS, type Destination } from "@/lib/planner"
import { LazyMap } from "./lazy-map"

// 담은 곳을 직선거리 기준으로 바로 이어 보여주는 미리보기와 "일정 만들기". 정확한 동선은 백엔드가 도로망 기준으로 계산한다.
export function PlanBar({
  route,
  totalKm,
  durationLabel,
  days,
  onBuild,
  building,
  stale,
}: {
  route: Destination[]
  totalKm: number
  durationLabel: string
  days: number
  onBuild: () => void
  building: boolean
  stale: boolean
}) {
  const empty = route.length === 0
  const tooMany = route.length > MAX_STOPS
  const effectiveDays = Math.min(days, Math.max(route.length, 1))

  return (
    <section aria-labelledby="plan-bar-title" className="flex shrink-0 flex-col overflow-hidden rounded-sm border border-border bg-card sm:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="plan-bar-title" className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
            담은 곳 · Your Picks
          </h2>
          {!empty && (
            <span className="font-serif text-xs tabular-nums text-muted-foreground">{`${route.length}곳 · 직선 ${totalKm.toLocaleString()} km`}</span>
          )}
        </div>

        {empty ? (
          <p className="text-pretty font-serif text-lg leading-relaxed text-muted-foreground">
            목록에서 여행지를 누르면 바로 담겨요. <span className="text-foreground">+</span>를 누르면 자세한 정보를 볼 수 있어요.
          </p>
        ) : (
          <ol className="flex flex-wrap items-center gap-x-3 gap-y-2" aria-label="가까운 순서">
            {route.map((d, i) => (
              <Fragment key={d.id}>
                {i > 0 && <span className="h-px w-5 bg-input" aria-hidden />}
                <li className="flex items-baseline gap-2">
                  <span className="font-serif text-xs tabular-nums text-accent">{String(i + 1).padStart(2, "0")}</span>
                  <span className="font-serif text-base text-foreground">{d.name}</span>
                </li>
              </Fragment>
            ))}
          </ol>
        )}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
          <p className={tooMany ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
            {tooMany
              ? `한 번에 최대 ${MAX_STOPS}곳까지 일정을 만들 수 있어요.`
              : stale
                ? "담은 곳이 바뀌었어요. 일정을 다시 만들어 보세요."
                : effectiveDays < days && !empty
                  ? `담은 곳이 ${route.length}곳이라 ${effectiveDays}일 일정으로 만들어요.`
                  : `${durationLabel} · 도로망 기준 동선, 시간표, 날씨까지 알려 드려요`}
          </p>
          <button
            type="button"
            onClick={onBuild}
            disabled={empty || building || tooMany}
            className="inline-flex h-10 items-center gap-2 rounded-sm bg-primary px-5 text-[13px] tracking-wide text-primary-foreground transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {building ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {building ? "일정 만드는 중…" : stale ? "일정 다시 만들기" : "일정 만들기"}
            {!building && <ArrowUpRight className="size-4" strokeWidth={1.25} aria-hidden />}
          </button>
        </div>
      </div>

      <div className="relative h-44 shrink-0 border-t border-border sm:h-auto sm:w-64 sm:border-l sm:border-t-0 lg:w-72">
        <LazyMap points={route} />
      </div>
    </section>
  )
}
