import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { categoryImageFor, categoryLabelFor, formatCount, type Category } from "@/lib/tourism-data"
import { SafeImage } from "@/components/safe-image"
import { TrendBadge } from "@/components/trend-badge"
import { pad2 } from "@/components/section-heading"
import { cn } from "@/lib/utils"

export type RankRowItem = {
  // 관광지 DB와 매칭되지 않은 항목은 상세 페이지가 없어 링크 없이 표시한다.
  href: string | null
  rank: number
  name: string
  category: Category
  image: string
  searches: number
  trend?: number
  meta?: string
}

export function RankRow({ item }: { item: RankRowItem }) {
  const top = item.rank <= 3
  const label = categoryLabelFor(item.category)

  const content = (
    <>
      <span className="w-6 shrink-0 font-serif text-sm tabular-nums text-muted-foreground">{pad2(item.rank)}</span>

      <div className="relative size-14 shrink-0 overflow-hidden bg-muted md:size-20">
        <SafeImage
          src={item.image}
          fallback={categoryImageFor(item.category)}
          alt=""
          fill
          sizes="80px"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span
          className={cn(
            "truncate font-serif text-lg md:text-xl",
            item.href && "transition-colors group-hover:text-accent",
          )}
        >
          {item.name}
        </span>
        <span className="truncate text-sm text-muted-foreground">{item.meta ? `${item.meta} · ${label}` : label}</span>
      </div>

      <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
        <span className="font-serif tabular-nums">{formatCount(item.searches)}</span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          검색량
          {item.trend !== undefined && <TrendBadge trend={item.trend} />}
        </span>
      </div>

      <span
        aria-hidden
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full border transition-colors",
          top
            ? "border-accent bg-accent font-serif text-sm text-accent-foreground"
            : item.href
              ? "border-border text-muted-foreground group-hover:border-foreground group-hover:text-foreground"
              : "border-transparent",
        )}
      >
        {top ? item.rank : item.href ? <ArrowUpRight className="size-4" /> : null}
      </span>
    </>
  )

  const rowClass = "group flex items-center gap-4 py-4 md:gap-6 md:py-5"

  return (
    <li className="border-b border-border">
      {item.href ? (
        <Link href={item.href} className={rowClass}>
          {content}
        </Link>
      ) : (
        <div className={rowClass}>{content}</div>
      )}
    </li>
  )
}
