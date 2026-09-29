import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { HomeHero } from "@/components/home-hero"
import { RegionGrid } from "@/components/region-grid"
import { FeaturedRanking } from "@/components/featured-ranking"
import { FloatingChatbot } from "@/components/floating-chatbot"
import { getTopAcrossRegions } from "@/lib/tourism-data"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const month = new Date().getMonth()
  const topItems = await getTopAcrossRegions(month)

  return (
    <>
      <SiteHeader />
      <main>
        <HomeHero />
        <RegionGrid month={month} />
        <FeaturedRanking initialMonth={month} initialItems={topItems} />
      </main>
      <SiteFooter />
      <FloatingChatbot />
    </>
  )
}
