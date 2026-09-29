import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Eyebrow } from "@/components/section-heading"

export function HomeHero() {
  return (
    <section className="mx-auto grid max-w-7xl items-end gap-10 px-5 pt-12 pb-16 md:grid-cols-[1.1fr_1fr] md:gap-14 md:px-10 md:pt-20 md:pb-24">
      <div className="flex flex-col gap-7">
        <Eyebrow>Gyeonggi North · Travel Index</Eyebrow>
        <h1 className="font-serif text-4xl leading-tight text-balance md:text-6xl md:leading-tight">
          경기북부,
          <br />
          이번 달엔 어디로 갈까요?
        </h1>
        <p className="max-w-md leading-relaxed text-muted-foreground text-pretty">
          가평부터 포천까지 10개 지역의 월별 검색량을 모아 지금 가장 많이 찾는 관광지를 보여드리고, 가고 싶은 곳을 담으면 AI가 날짜별
          여행 동선까지 짜 드립니다.
        </p>
        {/* 대표 행동은 AI 동선 플래너, 순위는 바로 아래 영역으로 — 헤더 메뉴와 역할이 겹치지 않게 둘로만 나눈다. */}
        <div className="flex flex-wrap items-center gap-6">
          <Link
            href="/planner"
            className="inline-flex items-center gap-2 bg-primary px-6 py-3.5 text-sm text-primary-foreground transition-colors hover:bg-primary/85"
          >
            AI로 여행 동선 만들기
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link
            href="#regions"
            className="border-b border-foreground pb-0.5 text-sm transition-colors hover:border-accent hover:text-accent"
          >
            인기 순위 둘러보기
          </Link>
        </div>
      </div>

      <figure className="flex flex-col gap-3">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <Image
            src="/images/hero.png"
            alt="경기북부의 산과 호수 풍경"
            fill
            priority
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
        <figcaption className="flex justify-between text-xs uppercase tracking-[0.25em] text-muted-foreground">
          <span>Gyeonggi North</span>
          <span>10 Regions</span>
        </figcaption>
      </figure>
    </section>
  )
}
