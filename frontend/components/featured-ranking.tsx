"use client";

import { useEffect, useState } from "react";
import {
  attractionHref,
  categoryImageFor,
  getTopAcrossRegions,
  imageFor,
  months,
  rerank,
  type RegionTopItem,
  type ViewMode,
} from "@/lib/tourism-data";
import { SectionHeading } from "@/components/section-heading";
import { MonthTabs } from "@/components/month-tabs";
import { RankRow } from "@/components/rank-row";
import { TopPicksCard } from "@/components/top-picks-card";
import { ViewModeToggle } from "@/components/view-mode-toggle";

// 첫 달은 서버에서 받아오고, 다른 달은 선택할 때 브라우저에서 불러와 캐시한다.
export function FeaturedRanking({
  initialMonth,
  initialItems,
}: {
  initialMonth: number;
  initialItems: RegionTopItem[];
}) {
  const [month, setMonth] = useState(initialMonth);
  const [mode, setMode] = useState<ViewMode>("tour");
  const [byMonth, setByMonth] = useState<Record<number, RegionTopItem[]>>({
    [initialMonth]: initialItems,
  });
  const loaded = byMonth[month];
  const items = loaded ? rerank(loaded, null, mode, 10) : undefined;

  useEffect(() => {
    if (byMonth[month]) return;
    let cancelled = false;
    getTopAcrossRegions(month).then((data) => {
      if (!cancelled) setByMonth((current) => ({ ...current, [month]: data }));
    });
    return () => {
      cancelled = true;
    };
  }, [month, byMonth]);

  // 관광지 DB에 있는 곳(위치 정보가 있어 플래너에 담을 수 있는 곳)만 추린 상위 3곳
  const plannable = (items ?? []).filter((p) => p.attractionId).slice(0, 3);

  return (
    <section
      id="featured"
      aria-labelledby="featured-heading"
      className="scroll-mt-28 md:scroll-mt-32 border-t border-border"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-12 px-5 py-16 md:px-10 md:py-24">
        <SectionHeading
          id="featured-heading"
          eyebrow="Monthly · Top 10"
          title={`${months[month]} 경기북부 인기 TOP 10`}
          description="10개 지역을 통합한 검색량 순위입니다."
        >
          <div className="flex flex-col gap-4">
            <ViewModeToggle value={mode} onChange={setMode} />
            <MonthTabs value={month} onChange={setMonth} />
          </div>
        </SectionHeading>

        {!items ? (
          <p className="border-t border-border py-10 text-sm text-muted-foreground">
            순위를 불러오는 중이에요…
          </p>
        ) : items.length === 0 ? (
          <p className="border-t border-border py-10 text-sm text-muted-foreground">
            {`${months[month]} 데이터가 아직 없어요.`}
          </p>
        ) : (
          <>
            <ul className="border-t border-border">
              {items.map((it) => (
                <RankRow
                  key={`${it.regionId}-${it.key}`}
                  item={{
                    href: attractionHref(it.regionId, it.attractionId, month),
                    rank: it.rank,
                    name: it.name,
                    category: it.category,
                    image: imageFor(it),
                    searches: it.searches,
                    meta: it.regionName,
                  }}
                />
              ))}
            </ul>

            {plannable.length > 0 && (
              <TopPicksCard
                eyebrow={`이달의 추천 코스 · ${months[month]} 기준`}
                title="순위 상위 명소를 한 번에 다녀오는 코스"
                picks={plannable.map((p) => ({
                  rank: p.rank,
                  name: p.name,
                  sub: p.regionName,
                  href: attractionHref(p.regionId, p.attractionId, month),
                  image: imageFor(p),
                  imageFallback: categoryImageFor(p.category),
                  attractionId: p.attractionId,
                }))}
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}
