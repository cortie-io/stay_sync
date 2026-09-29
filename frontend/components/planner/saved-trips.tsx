"use client"

import Link from "next/link"
import { ArrowUpRight, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { fetchTrips, forgetSavedTrip, formatDate, loadSavedTripIds, type SavedTripSummary } from "@/lib/planner"
import { SafeImage } from "@/components/safe-image"
import { PlannerHeader } from "./planner-header"
import { SiteFooter } from "@/components/site-footer"

// 저장한 여행 — 로그인 없이 이 브라우저에 보관한 공유 ID로 목록을 만든다.
export function SavedTrips() {
  const [trips, setTrips] = useState<SavedTripSummary[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetchTrips(loadSavedTripIds())
      .then(setTrips)
      .catch(() => setError(true))
  }, [])

  function remove(shareId: string) {
    forgetSavedTrip(shareId)
    setTrips((current) => current?.filter((t) => t.shareId !== shareId) ?? null)
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <PlannerHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-5 py-10 lg:px-10">
        <div className="flex flex-col gap-2">
          <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Saved Trips</p>
          <h1 className="font-serif text-3xl">저장한 여행</h1>
          <p className="text-sm text-muted-foreground">이 브라우저에서 저장한 일정이에요. 링크를 공유하면 누구나 같은 일정을 볼 수 있어요.</p>
        </div>

        {error && <p className="text-sm text-destructive">저장한 여행을 불러오지 못했어요.</p>}
        {!error && trips === null && (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
            {Array.from({ length: 3 }, (_, i) => (
              <li key={i} className="h-64 animate-pulse rounded-sm bg-muted" />
            ))}
          </ul>
        )}
        {trips?.length === 0 && (
          <div className="flex flex-col items-start gap-4 border-t border-border pt-8">
            <p className="font-serif text-xl text-muted-foreground">아직 저장한 여행이 없어요.</p>
            <Link href="/planner" className="inline-flex h-10 items-center gap-2 rounded-sm bg-primary px-5 text-[13px] text-primary-foreground">
              여행 계획하러 가기 <ArrowUpRight className="size-4" aria-hidden />
            </Link>
          </div>
        )}
        {trips && trips.length > 0 && (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip) => (
              <li key={trip.shareId} className="group relative flex flex-col overflow-hidden rounded-sm border border-border">
                <Link href={`/planner/trip/${trip.shareId}`} className="flex flex-1 flex-col">
                  <span className="relative aspect-[16/10] bg-muted">
                    <SafeImage src={trip.cover || "/placeholder.svg"} fallback="/placeholder.svg" alt="" fill sizes="320px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                  </span>
                  <span className="flex flex-col gap-1.5 p-4">
                    <span className="font-serif text-lg group-hover:text-accent">{trip.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {[formatDate(trip.startDate), trip.durationLabel, `${trip.stopCount}곳`].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => remove(trip.shareId)}
                  aria-label={`${trip.title} 목록에서 지우기`}
                  className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-background/90 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
