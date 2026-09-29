import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { fetchTrip } from "@/lib/planner"
import { SharedTrip } from "@/components/planner/shared-trip"

export const dynamic = "force-dynamic"

type Params = Promise<{ shareId: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { shareId } = await params
  const trip = await fetchTrip(shareId).catch(() => null)
  if (!trip) return { title: "일정을 찾을 수 없어요 | stay-sync 플래너" }
  const stops = trip.itinerary.days.flatMap((d) => d.stops.map((s) => s.name))
  return {
    title: `${trip.title} | stay-sync 플래너`,
    description: `${trip.itinerary.durationLabel ?? ""} · ${stops.slice(0, 5).join(", ")}${stops.length > 5 ? " 외" : ""}`.trim(),
  }
}

export default async function SharedTripPage({ params }: { params: Params }) {
  const { shareId } = await params
  const trip = await fetchTrip(shareId).catch(() => null)
  if (!trip) notFound()
  return <SharedTrip shareId={trip.shareId} itinerary={trip.itinerary} />
}
