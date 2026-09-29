"use client"

import Link from "next/link"
import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { regions } from "@/lib/tourism-data"
import { cn } from "@/lib/utils"

// 상단 메뉴바 아래 지역 바로가기 — 10개 지역 순위 페이지로 바로 이동한다. 보고 있는 지역은 강조한다.
export function RegionNav() {
  const pathname = usePathname()
  const currentRegion = pathname.match(/^\/(?:region|attraction)\/([^/?#]+)/)?.[1] ?? null
  const activeRef = useRef<HTMLAnchorElement>(null)

  // 좁은 화면에서 뒤쪽 지역을 보고 있으면 메뉴를 밀어 현재 지역이 보이게 한다.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center" })
  }, [currentRegion])

  return (
    <nav aria-label="지역 바로가기" className="border-t border-border">
      <ul className="scrollbar-none mx-auto flex h-10 max-w-7xl items-center gap-1 overflow-x-auto px-3 md:justify-center md:gap-2 md:px-10">
        {regions.map((r) => {
          const active = r.id === currentRegion
          return (
            <li key={r.id} className="shrink-0">
              <Link
                href={`/region/${r.id}`}
                ref={active ? activeRef : undefined}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative block px-2.5 py-2 text-[13px] tracking-wide transition-colors md:px-3",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r.name}
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-x-2.5 bottom-0 h-px bg-accent transition-opacity md:inset-x-3",
                    active ? "opacity-100" : "opacity-0",
                  )}
                />
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
