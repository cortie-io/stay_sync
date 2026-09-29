"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowUpRight } from "lucide-react"
import {
  attractionHref,
  categoryImageFor,
  categoryLabelFor,
  formatCount,
  imageFor,
  months,
  rerank,
  type AttractionExtras,
  type AttractionStats,
  type RankedAttraction,
} from "@/lib/tourism-data"
import { Eyebrow, pad2 } from "@/components/section-heading"
import { RankRow } from "@/components/rank-row"
import { TrendBadge } from "@/components/trend-badge"
import { SafeImage } from "@/components/safe-image"
import { AttractionFacts, AttractionGallery, AttractionMap, NearbyPlaces } from "@/components/attraction-extras"
import { cn } from "@/lib/utils"

export function AttractionDetail({
  stats,
  rankingsByMonth,
  extras,
  initialMonth,
}: {
  stats: AttractionStats
  rankingsByMonth: RankedAttraction[][]
  extras: AttractionExtras | null
  initialMonth: number
}) {
  const [month, setMonth] = useState(initialMonth)
  const { attraction, category: attractionCategory, monthly, regionId, regionName } = stats
  const image = attraction.image || categoryImageFor(attractionCategory)
  const category = attractionCategory?.small || categoryLabelFor(attractionCategory)

  const current = monthly[month]
  const prev = monthly[(month + 11) % 12]
  // 순위가 없는 달(null)은 전월 대비를 0으로 본다.
  const trend = current.rank != null && prev.rank != null ? prev.rank - current.rank : 0
  const max = Math.max(...monthly.map((s) => s.searches), 1)
  const peaks = useMemo(
    () =>
      [...monthly]
        .filter((s) => s.searches > 0)
        .sort((a, b) => b.searches - a.searches)
        .slice(0, 3),
    [monthly],
  )
  const peakSet = new Set(peaks.map((p) => p.monthIndex))
  // 검색량 순위에 오르지 않은 관광지(주변 관광지 등에서 들어온 경우)는 통계가 비어 있다.
  const hasStats = peaks.length > 0

  const others = useMemo(
    () =>
      rerank(rankingsByMonth[month] ?? [], null, "tour")
        .filter((x) => x.attractionId !== attraction.id)
        .slice(0, 4),
    [rankingsByMonth, month, attraction.id],
  )

  const selectMonth = (i: number) => {
    setMonth(i)
    window.history.replaceState(null, "", `?m=${i}`)
  }

  return (
    <article className="mx-auto flex max-w-6xl flex-col px-5 pb-24 md:px-10">
      <div className="flex items-center justify-between gap-4 py-8">
        <Link
          href={`/region/${regionId}?m=${month}`}
          className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {`${regionName} 순위로 돌아가기`}
        </Link>
        <nav aria-label="현재 위치" className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
          <Link href="/" className="hover:text-foreground">
            홈
          </Link>
          <span aria-hidden>/</span>
          <Link href={`/region/${regionId}?m=${month}`} className="hover:text-foreground">
            {regionName}
          </Link>
          <span aria-hidden>/</span>
          <span aria-current="page" className="text-foreground">
            {attraction.title}
          </span>
        </nav>
      </div>

      <header className="flex flex-col items-center gap-5 pt-6 pb-12 text-center md:pt-10 md:pb-16">
        <Eyebrow>{`${regionName} · ${category}`}</Eyebrow>
        <h1 className="font-serif text-4xl leading-tight text-balance md:text-6xl">{attraction.title}</h1>
        {attraction.address && (
          <p className="max-w-xl leading-relaxed text-muted-foreground text-pretty">{attraction.address}</p>
        )}
      </header>

      <figure className="flex flex-col gap-3">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted md:aspect-[21/9]">
          <SafeImage
            src={image}
            fallback={categoryImageFor(attractionCategory)}
            alt={attraction.title}
            fill
            priority
            sizes="(min-width: 1152px) 1072px, 100vw"
            className="object-cover"
          />
        </div>
        <figcaption className="flex justify-between text-xs text-muted-foreground">
          <span>{`${regionName}, 경기북부`}</span>
          <span className="tracking-[0.2em] uppercase">stay-sync</span>
        </figcaption>
      </figure>

      {attraction.description && (
        <section aria-labelledby="about-heading" className="mx-auto flex w-full max-w-3xl flex-col gap-5 pt-14">
          <Eyebrow>About</Eyebrow>
          <h2 id="about-heading" className="sr-only">
            {`${attraction.title} 소개`}
          </h2>
          <div className="flex flex-col gap-4 leading-loose text-foreground/85 text-pretty">
            {attraction.description
              .split(/\n+/)
              .map((paragraph) => paragraph.trim())
              .filter(Boolean)
              .map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
          </div>
          <p className="text-xs text-muted-foreground">출처 · 한국관광공사 TourAPI</p>
        </section>
      )}

      {extras && <AttractionFacts extras={extras} address={attraction.address} />}
      {extras && (
        <AttractionGallery
          images={extras.images}
          title={attraction.title}
          fallback={categoryImageFor(attractionCategory)}
        />
      )}

      {!hasStats && (
        <p className="mt-20 border-y border-border py-8 text-center text-sm text-muted-foreground">
          {`${attraction.title}은(는) 아직 월별 검색량 순위 집계 대상이 아니에요.`}
        </p>
      )}

      {hasStats && (
        <dl className="mt-20 grid grid-cols-2 border-y border-border md:grid-cols-4">
          <Stat label={`${months[month]} 지역 순위 (전체 기준)`} className="border-r md:border-r">
            <span className="text-accent">{current.rank ?? "-"}</span>
            {current.rank != null && <span className="text-base text-muted-foreground">위</span>}
          </Stat>
          <Stat label="월간 검색량" className="md:border-r">
            {formatCount(current.searches)}
          </Stat>
          <Stat label="전월 대비" className="border-t border-r md:border-t-0">
            <TrendBadge trend={trend} className="text-xl [&_svg]:size-4" />
          </Stat>
          <Stat label="추천 시기" className="border-t md:border-t-0">
            <span className="whitespace-nowrap text-lg md:text-xl">
              {peaks.length ? peaks.map((p) => `${p.monthIndex + 1}월`).join(" · ") : "-"}
            </span>
          </Stat>
        </dl>
      )}

      {hasStats && (
        <section aria-labelledby="trend-heading" className="flex flex-col gap-10 pt-20">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-3">
              <Eyebrow>Monthly Search</Eyebrow>
              <h2 id="trend-heading" className="font-serif text-3xl">
                월별 검색량 추이
              </h2>
            </div>
            <p className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <span aria-hidden className="size-2 rounded-full bg-accent" />
                선택한 달
              </span>
              <span className="flex items-center gap-2">
                <span aria-hidden className="size-2 rounded-full bg-foreground/25" />
                성수기
              </span>
            </p>
          </div>

          <div role="group" aria-label="월 선택" className="flex h-64 items-stretch gap-1.5 md:gap-3">
            {monthly.map((s) => {
              const active = s.monthIndex === month
              const peak = peakSet.has(s.monthIndex)
              const height = Math.max(6, Math.round((s.searches / max) * 100))
              return (
                <button
                  key={s.monthIndex}
                  type="button"
                  onClick={() => selectMonth(s.monthIndex)}
                  aria-pressed={active}
                  aria-label={`${months[s.monthIndex]} 검색량 ${formatCount(s.searches)}${s.rank != null ? `, ${s.rank}위` : ""}`}
                  className="group flex min-w-0 flex-1 flex-col items-center gap-3 focus-visible:outline-none"
                >
                  <div className="flex w-full flex-1 flex-col items-center justify-end gap-2">
                    <span
                      className={cn(
                        "font-serif text-xs tabular-nums transition-opacity",
                        active ? "text-accent opacity-100" : "opacity-0 group-hover:opacity-100",
                      )}
                    >
                      {s.rank != null ? `${s.rank}위` : "-"}
                    </span>
                    <div
                      className={cn(
                        "w-full max-w-10 rounded-t-sm transition-colors group-focus-visible:ring-2 group-focus-visible:ring-ring",
                        active
                          ? "bg-accent"
                          : peak
                            ? "bg-foreground/25 group-hover:bg-foreground/40"
                            : "bg-muted group-hover:bg-foreground/15",
                      )}
                      style={{ height: `${height}%` }}
                    />
                  </div>
                  <span
                    className={cn(
                      "text-xs tabular-nums",
                      active ? "font-medium text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {`${s.monthIndex + 1}월`}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {extras?.location && (
        <AttractionMap title={attraction.title} location={extras.location} address={attraction.address} />
      )}
      {extras && <NearbyPlaces nearby={extras.nearby} monthIndex={month} />}

      <div className="grid gap-16 pt-24 lg:grid-cols-[1fr_20rem] lg:gap-20">
        <section aria-labelledby="others-heading" className="flex min-w-0 flex-col gap-8">
          <div className="flex flex-col gap-3">
            <Eyebrow>More in {regionName}</Eyebrow>
            <h2 id="others-heading" className="font-serif text-3xl text-balance">
              {`${months[month]}, ${regionName}의 다른 명소`}
            </h2>
          </div>
          <ul className="border-t border-border">
            {others.map((o) => (
              <RankRow
                key={o.key}
                item={{
                  href: attractionHref(regionId, o.attractionId, month),
                  rank: o.rank,
                  name: o.name,
                  category: o.category,
                  image: imageFor(o),
                  searches: o.searches,
                  trend: o.trend,
                }}
              />
            ))}
          </ul>
        </section>

        <aside aria-labelledby="best-heading" className="flex flex-col gap-8 lg:sticky lg:top-40 lg:self-start">
          <div className="flex flex-col gap-3">
            <Eyebrow>Best Months</Eyebrow>
            <h2 id="best-heading" className="font-serif text-3xl">
              방문 추천 시기
            </h2>
          </div>
          {peaks.length > 0 ? (
            <ol className="border-t border-border">
              {peaks.map((p, i) => (
                <li key={p.monthIndex}>
                  <button
                    type="button"
                    onClick={() => selectMonth(p.monthIndex)}
                    aria-pressed={p.monthIndex === month}
                    className="group flex w-full items-center gap-5 border-b border-border py-5 text-left"
                  >
                    <span className="font-serif text-sm tabular-nums text-muted-foreground">{pad2(i + 1)}</span>
                    <span className="flex flex-1 flex-col gap-1">
                      <span
                        className={cn(
                          "font-serif text-xl transition-colors",
                          p.monthIndex === month ? "text-accent" : "group-hover:text-accent",
                        )}
                      >
                        {months[p.monthIndex]}
                      </span>
                      <span className="text-xs text-muted-foreground">{`검색량 ${formatCount(p.searches)}`}</span>
                    </span>
                    <span className="font-serif text-sm tabular-nums text-muted-foreground">
                      {p.rank != null ? `${p.rank}위` : "-"}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="border-t border-border py-6 text-sm text-muted-foreground">검색량 데이터가 없어요.</p>
          )}
          <Link
            href={`/region/${regionId}?m=${month}`}
            className="flex items-center justify-between gap-3 bg-foreground px-6 py-4 text-sm text-background transition-colors hover:bg-accent"
          >
            {`${regionName} 전체 순위 보기`}
            <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        </aside>
      </div>
    </article>
  )
}

function Stat({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 border-border px-5 py-7 md:px-8", className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="flex items-baseline gap-1 font-serif text-3xl tabular-nums">{children}</dd>
    </div>
  )
}
