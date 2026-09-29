import Link from "next/link"
import { categoryImageFor, getRegionLeaders, imageFor, months, regions } from "@/lib/tourism-data"
import { SafeImage } from "@/components/safe-image"
import { SectionHeading, pad2 } from "@/components/section-heading"

export async function RegionGrid({ month }: { month: number }) {
  const leaders = await getRegionLeaders(month)

  return (
    <section id="regions" aria-labelledby="regions-heading" className="scroll-mt-28 md:scroll-mt-32 border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-col gap-12 px-5 py-16 md:px-10 md:py-24">
        <SectionHeading
          id="regions-heading"
          eyebrow="Regions · 10"
          title="지역을 선택하세요"
          description="지역을 고르면 달별 검색량에 따른 인기 관광지 순위를 볼 수 있어요."
        />

        <ul className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-5">
          {regions.map((r, i) => {
            const top = leaders[r.id]
            return (
              <li key={r.id}>
                <Link href={`/region/${r.id}?m=${month}`} className="group flex flex-col gap-4">
                  <div className="relative aspect-square overflow-hidden bg-muted">
                    <SafeImage
                      src={top ? imageFor(top) : "/images/hero.png"}
                      fallback={top ? categoryImageFor(top.category) : "/images/hero.png"}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 20vw, (min-width: 768px) 33vw, 50vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-baseline gap-2">
                      <span className="font-serif text-sm text-muted-foreground">{pad2(i + 1)}</span>
                      <span className="font-serif text-xl transition-colors group-hover:text-accent">{r.name}</span>
                    </div>
                    <p className="line-clamp-1 text-sm text-muted-foreground">{r.tagline}</p>
                    {top && (
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {`${months[month]} 1위 · `}
                        <span className="text-foreground">{top.name}</span>
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
