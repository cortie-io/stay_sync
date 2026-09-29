"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"

function BrandMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
      <circle cx="12" cy="12" r="10.5" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M6.5 15.5 C 9 8.5, 15 15.5, 17.5 8.5" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <circle cx="6.5" cy="15.5" r="1.6" className="fill-accent" />
      <circle cx="17.5" cy="8.5" r="1.6" fill="currentColor" />
    </svg>
  )
}

const NAV = [
  { href: "/planner", label: "동선 만들기" },
  { href: "/planner/saved", label: "저장한 여행" },
]

export function PlannerHeader() {
  const pathname = usePathname()
  return (
    <header className="grid h-16 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-border bg-background px-5 lg:px-8">
      <nav aria-label="플래너 메뉴" className="flex items-center gap-5 md:gap-7">
        {NAV.map((item) => {
          const active = item.href === "/planner" ? pathname === "/planner" : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "text-xs tracking-wide transition-colors md:text-[13px]",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                item.href === "/planner" && "hidden sm:inline",
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      <Link href="/planner" className="col-start-2 flex items-center gap-3 text-foreground">
        <BrandMark />
        <span className="font-serif text-[13px] font-medium uppercase tracking-[0.32em] sm:text-[15px]">
          <span className="hidden sm:inline">Stay-Sync </span>Planner
        </span>
      </Link>

      <div className="flex items-center justify-end">
        {/* 기본 인터페이스로 돌아가기 — 기본 화면의 "AI 동선 플래너" 버튼과 같은 자리 */}
        <Link
          href="/"
          aria-label="기본 화면으로"
          className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap border border-foreground px-2.5 py-1.5 text-xs tracking-wide text-foreground transition-colors hover:bg-foreground hover:text-background sm:px-3"
        >
          <ArrowLeft className="size-3.5" strokeWidth={1.5} aria-hidden />
          <span className="hidden sm:inline">기본 화면</span>
        </Link>
      </div>
    </header>
  )
}
