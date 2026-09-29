"use client";

import { useState } from "react";
import Link from "next/link";
import {
  attractionHref,
  categoryImageFor,
  imageFor,
  months,
  regions,
  rerank,
  type RankedAttraction,
  type Region,
  type ViewMode,
} from "@/lib/tourism-data";
import { Eyebrow } from "@/components/section-heading";
import { MonthTabs } from "@/components/month-tabs";
import { RankRow } from "@/components/rank-row";
import { TopPicksCard } from "@/components/top-picks-card";
import { ViewModeToggle } from "@/components/view-mode-toggle";
import { cn } from "@/lib/utils";

export function RegionRanking({
  region,
  initialMonth,
  rankingsByMonth,
}: {
  region: Region;
  initialMonth: number;
  rankingsByMonth: RankedAttraction[][];
}) {
  const [month, setMonth] = useState(initialMonth);
  const [mode, setMode] = useState<ViewMode>("tour");
  const ranking = rerank(
    rankingsByMonth[month] ?? [],
    month > 0 ? rankingsByMonth[month - 1] : null,
    mode,
  );
  // 관광지 DB에 있는 곳(위치 정보가 있어 플래너에 담을 수 있는 곳)만 추린 상위 3곳
  const plannable = ranking.filter((p) => p.attractionId).slice(0, 3);

  const selectMonth = (i: number) => {
    setMonth(i);
    window.history.replaceState(null, "", `?m=${i}`);
  };

  const detailHref = (attractionId: number | null) =>
    attractionHref(region.id, attractionId, month);

  return (
    <div className="mx-auto max-w-7xl px-5 md:px-10">
      <nav
        aria-label="현재 위치"
        className="flex items-center gap-2 pt-8 text-xs text-muted-foreground"
      >
        <Link href="/" className="hover:text-foreground">
          홈
        </Link>
        <span aria-hidden>/</span>
        <Link href="/#regions" className="hover:text-foreground">
          지역
        </Link>
        <span aria-hidden>/</span>
        <span aria-current="page" className="text-foreground">
          {region.name}
        </span>
      </nav>

      <div className="flex pt-10 pb-20 md:pb-28">
        <div className="flex min-w-0 flex-1 flex-col gap-12">
          <header className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex flex-col gap-3">
              <Eyebrow>{`Region · ${region.id}`}</Eyebrow>
              <h1 className="font-serif text-4xl leading-tight text-balance md:text-5xl">{`${region.name} 인기 관광지`}</h1>
              <p className="leading-relaxed text-muted-foreground">
                {`${region.tagline} · ${months[month]} 검색량 기준 ${ranking.length}곳`}
              </p>
            </div>
            <div className="flex flex-col gap-4">
              <ViewModeToggle value={mode} onChange={setMode} />
              <MonthTabs value={month} onChange={selectMonth} />
            </div>
          </header>

          {ranking.length === 0 ? (
            <p className="border-t border-border py-10 text-sm text-muted-foreground">
              {`${months[month]} 데이터가 아직 없어요.`}
            </p>
          ) : (
            <>
              <ul className="border-t border-border">
                {ranking.map((a) => (
                  <RankRow
                    key={a.key}
                    item={{
                      href: detailHref(a.attractionId),
                      rank: a.rank,
                      name: a.name,
                      category: a.category,
                      image: imageFor(a),
                      searches: a.searches,
                      trend: a.trend,
                    }}
                  />
                ))}
              </ul>

              {plannable.length > 0 && (
                <TopPicksCard
                  eyebrow={`${region.name} 추천 코스 · ${months[month]} 기준`}
                  title={`${region.name} 순위 상위 명소를 한 번에 다녀오는 코스`}
                  picks={plannable.map((p) => ({
                    rank: p.rank,
                    name: p.name,
                    href: detailHref(p.attractionId),
                    image: imageFor(p),
                    imageFallback: categoryImageFor(p.category),
                    attractionId: p.attractionId,
                  }))}
                />
              )}
            </>
          )}

          <nav
            aria-label="다른 지역"
            className="flex flex-col gap-4 border-t border-border pt-8"
          >
            <Eyebrow>Other Regions</Eyebrow>
            <ul className="flex flex-wrap gap-x-6 gap-y-3">
              {regions.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/region/${r.id}?m=${month}`}
                    aria-current={r.id === region.id ? "page" : undefined}
                    className={cn(
                      "font-serif text-lg transition-colors",
                      r.id === region.id
                        ? "text-accent"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {r.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </div>
  );
}
