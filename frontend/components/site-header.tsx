import Link from "next/link"
import { RegionNav } from "@/components/region-nav"

const navLinks = [
  { href: "/#regions", label: "지역별 순위" },
  { href: "/#featured", label: "이달의 인기" },
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-5 md:h-20 md:px-10">
        <nav aria-label="주요 메뉴" className="flex items-center gap-8 text-sm text-muted-foreground">
          {navLinks.map((l) => (
            <Link key={l.href} href={l.href} className="hidden transition-colors hover:text-foreground md:inline">
              {l.label}
            </Link>
          ))}
          <Link href="/#regions" className="transition-colors hover:text-foreground md:hidden">
            지역
          </Link>
        </nav>

        <Link href="/" aria-label="stay-sync 홈" className="col-start-2 flex items-center gap-3">
          <LogoMark />
          <span className="font-serif text-sm uppercase tracking-[0.4em] md:text-base">Stay-Sync</span>
        </Link>

        <div className="flex items-center justify-end gap-6 text-sm text-muted-foreground">
          <span className="hidden lg:inline">경기북부 10개 지역</span>
          {/* 두 번째 인터페이스(AI 동선 플래너)로 전환 */}
          <Link
            href="/planner"
            className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap border border-foreground px-2.5 py-1.5 text-xs tracking-wide text-foreground transition-colors hover:bg-foreground hover:text-background sm:px-3 md:text-sm"
          >
            <span aria-hidden className="size-1.5 rounded-full bg-accent" />
            <span className="sm:hidden">AI 플래너</span>
            <span className="hidden sm:inline">AI 동선 플래너</span>
          </Link>
        </div>
      </div>
      <RegionNav />
    </header>
  )
}

export function LogoMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-7 md:size-8" aria-hidden>
      <circle cx="16" cy="16" r="14.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M8.5 20.5c3-.5 4.5-8.5 7.5-8.5s3 5.5 6.5 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="22.8" cy="16.3" r="1.8" className="fill-accent" />
    </svg>
  )
}
