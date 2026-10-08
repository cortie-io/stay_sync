"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ArrowRight, Loader2, Route } from "lucide-react"
import { Eyebrow, pad2 } from "@/components/section-heading"
import { SafeImage } from "@/components/safe-image"
import { fetchDestinationsByIds, PLANNER_ADD_STORAGE_KEY } from "@/lib/planner"

type Pick = {
  rank: number
  name: string
  sub?: string
  href: string | null
  image: string
  imageFallback: string
  // 관광지 DB와 매칭된 곳만 플래너에 담을 수 있다.
  attractionId: number | null
}

// 순위에서 플래너에 담을 수 있는(위치 정보가 있는) 상위 3곳을 한 번에 AI 동선 플래너로 넘기는 카드. 각 칸은 상세 페이지로 이어진다.
export function TopPicksCard({ eyebrow, title, picks }: { eyebrow: string; title: string; picks: Pick[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ids = picks.map((p) => p.attractionId).filter((id): id is number => id != null)

  async function planWithPicks() {
    if (busy || ids.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const destinations = await fetchDestinationsByIds(ids)
      if (destinations.length === 0) throw new Error("empty")
      window.sessionStorage.setItem(PLANNER_ADD_STORAGE_KEY, JSON.stringify(destinations))
      router.push("/planner")
    } catch {
      setError("여행지를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.")
      setBusy(false)
    }
  }

  return (
    <section className="flex flex-col gap-5 border border-border p-5 md:gap-6 md:p-8">
      {/* 모바일은 제목 → 3칸 → 버튼(order-last), 데스크톱은 제목 옆에 버튼 */}
      <div className="contents md:flex md:flex-row md:items-end md:justify-between md:gap-4">
        <div className="flex flex-col gap-2">
          <Eyebrow>{eyebrow}</Eyebrow>
          <p className="font-serif text-lg md:text-2xl">{title}</p>
        </div>
        {ids.length > 0 && (
          <div className="order-last flex flex-col gap-2 md:order-none md:items-end">
            <button
              type="button"
              onClick={planWithPicks}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 bg-primary px-5 py-3 text-sm text-primary-foreground transition-colors hover:bg-primary/85 disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Route className="size-4" aria-hidden />}
              {`이 ${ids.length}곳으로 AI 동선 만들기`}
              <ArrowRight className="size-4" aria-hidden />
            </button>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}
      </div>

      <ol className="grid grid-cols-3 gap-2.5 md:gap-4">
        {picks.map((p, i) => {
          const body = (
            <>
              <div className="relative aspect-square overflow-hidden bg-muted md:aspect-[4/3]">
                <SafeImage
                  src={p.image}
                  fallback={p.imageFallback}
                  alt={p.name}
                  fill
                  sizes="(min-width: 640px) 33vw, 100vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="flex flex-col gap-0.5 md:flex-row md:items-baseline md:gap-2">
                <span className="font-serif text-xs text-accent md:text-sm">{pad2(p.rank)}</span>
                <span className="line-clamp-2 min-w-0 font-serif text-sm leading-snug md:truncate md:text-lg">{p.name}</span>
                {p.sub && <span className="text-[12px] text-muted-foreground md:ml-auto md:shrink-0 md:text-xs">{p.sub}</span>}
              </div>
            </>
          )
          return (
            <li key={`${p.name}-${i}`}>
              {p.href ? (
                <Link href={p.href} className="group flex flex-col gap-2 md:gap-3">
                  {body}
                </Link>
              ) : (
                <div className="flex flex-col gap-2 md:gap-3">{body}</div>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
