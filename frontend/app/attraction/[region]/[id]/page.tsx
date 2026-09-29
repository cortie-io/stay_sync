import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getAttractionExtras, getAttractionStats, getRankingsByYear, parseMonth } from "@/lib/tourism-data"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { AttractionDetail } from "@/components/attraction-detail"
import { FloatingChatbot } from "@/components/floating-chatbot"

export const dynamic = "force-dynamic"

type Params = Promise<{ region: string; id: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { region, id } = await params
  const stats = await getAttractionStats(region, Number.parseInt(id, 10))
  if (!stats) return {}
  return {
    title: `${stats.attraction.title} · ${stats.regionName} | stay-sync`,
    description: `${stats.regionName} ${stats.attraction.title}의 월별 검색량과 순위. ${stats.attraction.address ?? ""}`.trim(),
  }
}

export default async function AttractionPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: Promise<{ m?: string }>
}) {
  const { region, id } = await params
  const { m } = await searchParams
  const attractionId = Number.parseInt(id, 10)
  if (!Number.isInteger(attractionId)) notFound()

  const [stats, rankingsByMonth, extras] = await Promise.all([
    getAttractionStats(region, attractionId),
    getRankingsByYear(region),
    getAttractionExtras(attractionId),
  ])
  if (!stats) notFound()

  return (
    <>
      <SiteHeader />
      <main>
        <AttractionDetail
          key={`${region}-${id}`}
          stats={stats}
          rankingsByMonth={rankingsByMonth}
          extras={extras}
          initialMonth={parseMonth(m)}
        />
      </main>
      <SiteFooter />
      <FloatingChatbot />
    </>
  )
}
