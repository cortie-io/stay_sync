"use client"

import { useRouter } from "next/navigation"
import { Check, Copy, Pencil } from "lucide-react"
import { useState } from "react"
import { durationForDays, type Destination, type Itinerary } from "@/lib/planner"
import { PlannerHeader } from "./planner-header"
import { ItineraryView } from "./itinerary-view"
import { TEMPLATE_STORAGE_KEY } from "./planner-app"
import { SiteFooter } from "@/components/site-footer"
import { TripCover } from "./trip-cover"

// 공유 링크로 연 일정 — 그대로 보거나, 내 플래너로 가져와 고칠 수 있다.
export function SharedTrip({ shareId, itinerary, fromKiosk = false }: { shareId: string; itinerary: Itinerary; fromKiosk?: boolean }) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)

  function planWithThis() {
    const selected: Destination[] = itinerary.days.flatMap((d) =>
      d.stops.map((s) => ({
        id: s.id,
        name: s.name,
        region: s.region ?? "",
        tag: s.tag ?? "관광지",
        theme: s.theme ?? null,
        indoorOutdoor: s.indoorOutdoor ?? null,
        lat: s.lat,
        lng: s.lng,
        image: s.image ?? null,
      })),
    )
    try {
      window.sessionStorage.setItem(
        TEMPLATE_STORAGE_KEY,
        JSON.stringify({
          selected,
          itinerary,
          itineraryIds: selected.map((d) => d.id),
          durationId: durationForDays(itinerary.days.length).id,
          // 숙소·동행자도 이어받는다.
          accommodation: itinerary.accommodation
            ? { name: itinerary.accommodation.name, mapx: itinerary.accommodation.lng, mapy: itinerary.accommodation.lat }
            : null,
          companion: itinerary.companion ?? null,
          ...(itinerary.startDate && itinerary.startDate >= new Date().toISOString().slice(0, 10) ? { startDate: itinerary.startDate } : {}),
        }),
      )
    } catch {}
    router.push("/planner")
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/planner/trip/${shareId}`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <PlannerHeader />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-5 py-8 lg:px-10">
        <TripCover itinerary={itinerary} shareId={shareId} fromKiosk={fromKiosk} onPlanWithThis={planWithThis} />
        <div className="hidden flex-wrap items-center justify-between gap-3 rounded-sm bg-muted px-4 py-3 text-sm lg:flex">
          <span className="text-muted-foreground">공유받은 여행 일정이에요.</span>
          <div className="flex gap-2">
            <button type="button" onClick={copyLink} className="inline-flex h-9 items-center gap-2 rounded-sm border border-border bg-background px-3 text-[13px]">
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              {copied ? "복사했어요" : "링크 복사"}
            </button>
            <button type="button" onClick={planWithThis} className="inline-flex h-9 items-center gap-2 rounded-sm bg-primary px-4 text-[13px] text-primary-foreground">
              <Pencil className="size-4" aria-hidden />이 일정으로 계획하기
            </button>
          </div>
        </div>
        <h2 className="-mb-2 font-serif text-2xl">날짜별 동선</h2>
        <ItineraryView itinerary={itinerary} editable={false} shareId={shareId} hideHeader hideStory />
      </main>
      <SiteFooter />
    </div>
  )
}
