import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getRankingsByYear, getRegion, parseMonth } from "@/lib/tourism-data"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { RegionRanking } from "@/components/region-ranking"
import { FloatingChatbot } from "@/components/floating-chatbot"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const region = getRegion(id)
  if (!region) return {}
  return {
    title: `${region.name} 인기 관광지 순위 | stay-sync`,
    description: `${region.name}의 월별 검색량 기반 인기 관광지 순위를 확인하세요. ${region.tagline}`,
  }
}

export default async function RegionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ m?: string }>
}) {
  const { id } = await params
  const { m } = await searchParams
  const region = getRegion(id)
  if (!region) notFound()

  const rankingsByMonth = await getRankingsByYear(region.id)

  return (
    <>
      <SiteHeader />
      <main>
        <RegionRanking
          key={region.id}
          region={region}
          initialMonth={parseMonth(m)}
          rankingsByMonth={rankingsByMonth}
        />
      </main>
      <SiteFooter />
      <FloatingChatbot />
    </>
  )
}
