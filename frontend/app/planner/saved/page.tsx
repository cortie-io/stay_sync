import type { Metadata } from "next"
import { SavedTrips } from "@/components/planner/saved-trips"

export const metadata: Metadata = { title: "저장한 여행 | stay-sync 플래너" }

export default function SavedTripsPage() {
  return <SavedTrips />
}
