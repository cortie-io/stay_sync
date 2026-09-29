import type { Metadata } from "next"
import { PlannerApp } from "@/components/planner/planner-app"

export const metadata: Metadata = {
  title: "AI 동선 플래너 | stay-sync",
  description: "경기북부 여행지를 고르면 AI 여행 컨시어지가 도로망 기준 최적 동선과 일정을 지도와 함께 만들어 드립니다.",
}

export default function PlannerPage() {
  return <PlannerApp />
}
