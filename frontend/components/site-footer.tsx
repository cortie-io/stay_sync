import Link from "next/link"
import { ArrowUpRight, Mail, MapPin, Phone } from "lucide-react"
import { LogoMark } from "@/components/site-header"
import { regions } from "@/lib/tourism-data"

const KBU_HOME = "https://www.kbu.ac.kr"

const serviceLinks = [
  { href: "/#regions", label: "지역별 순위" },
  { href: "/#featured", label: "이달의 인기" },
  { href: "/planner", label: "AI 동선 플래너" },
  { href: "/planner/saved", label: "저장한 여행" },
]

const policyLinks = [
  { href: `${KBU_HOME}/kor/CMS/Board/Board.do?mCode=MN010`, label: "개인정보처리방침" },
  { href: `${KBU_HOME}/kor/CMS/Contents/Contents.do?mCode=MN011`, label: "이메일무단수집거부" },
  { href: `${KBU_HOME}/kor/Main.do`, label: "경복대학교 홈페이지" },
]

function ColumnTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">{children}</p>
}

// 서비스 소개·바로가기·지역·연락처 + 경복대학교 앵커사업단 · AI 디지털트윈연구원 운영 정보
export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-[#f6f5f2] text-[13px] text-foreground/80">
      <div className="mx-auto max-w-7xl px-5 md:px-10">
        <div className="grid gap-10 py-12 md:grid-cols-2 md:py-16 lg:grid-cols-[1.4fr_0.8fr_1fr_1.2fr] lg:gap-12">
          {/* 서비스 소개 */}
          <div className="flex flex-col gap-5">
            <Link href="/" aria-label="stay-sync 홈" className="flex items-center gap-3 text-foreground">
              <LogoMark />
              <span className="font-serif text-base uppercase tracking-[0.4em]">Stay-Sync</span>
            </Link>
            <p className="max-w-xs leading-relaxed text-muted-foreground">
              경기북부 10개 지역의 월별 검색량으로 지금 인기 있는 관광지를 보여 주고, 담은 곳을 AI가 날짜별 여행 동선으로 짜 드려요.
            </p>
            <Link
              href="/planner"
              className="inline-flex w-fit items-center gap-2 border border-foreground px-3.5 py-2 text-xs tracking-wide text-foreground transition-colors hover:bg-foreground hover:text-background"
            >
              <span aria-hidden className="size-1.5 rounded-full bg-accent" />
              AI 동선 만들기
              <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          </div>

          {/* 바로가기 */}
          <nav aria-label="바로가기" className="flex flex-col gap-4">
            <ColumnTitle>Service</ColumnTitle>
            <ul className="flex flex-col gap-2.5">
              {serviceLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="transition-colors hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* 지역 */}
          <nav aria-label="지역별 순위" className="flex flex-col gap-4">
            <ColumnTitle>Regions</ColumnTitle>
            <ul className="grid grid-cols-3 gap-x-4 gap-y-2.5 md:grid-cols-2">
              {regions.map((r) => (
                <li key={r.id}>
                  <Link href={`/region/${r.id}`} className="transition-colors hover:text-foreground">
                    {r.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* 연락처 */}
          <div className="flex flex-col gap-4">
            <ColumnTitle>Contact</ColumnTitle>
            <address className="flex flex-col gap-2.5 not-italic leading-relaxed">
              <p className="flex gap-2.5">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span>(12051) 경기도 남양주시 진접읍 경복대로 425</span>
              </p>
              <p className="flex gap-2.5">
                <Phone className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span>
                  <a href="tel:031-570-9870" className="hover:text-foreground">
                    031-570-9870
                  </a>
                  <span className="text-muted-foreground"> · 평일 09시~18시</span>
                </span>
              </p>
              <p className="flex gap-2.5">
                <Mail className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <a href="mailto:kcs@kbu.ac.kr" className="hover:text-foreground">
                  kcs@kbu.ac.kr
                </a>
              </p>
            </address>
          </div>
        </div>

        {/* 운영 기관 로고 */}
        <div className="flex flex-col gap-4 border-t border-border py-8 md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-muted-foreground">경복대학교 앵커사업단 · AI 디지털트윈연구원과 함께 만듭니다</p>
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <span className="flex h-11 items-center rounded-sm bg-white px-3 md:h-14 md:px-4 shadow-[0_0_0_1px_var(--border)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/partners/kbu-anchor.png" alt="경복대학교 앵커사업단 ANCHOR" className="h-6 w-auto md:h-8" />
            </span>
            <span className="flex h-11 items-center rounded-sm bg-white px-3 md:h-14 md:px-4 shadow-[0_0_0_1px_var(--border)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/partners/kbu-ai-digital-twin.png" alt="경복대학교 AI 디지털트윈연구원" className="h-6 w-auto md:h-8" />
            </span>
          </div>
        </div>

        {/* 정책 · 저작권 (모바일은 우하단 챗봇 버튼에 가리지 않게 아래 여백을 넉넉히) */}
        <div className="flex flex-col gap-3 border-t border-border pt-6 pb-28 text-xs md:flex-row md:items-center md:justify-between md:pb-24">
          <ul className="flex flex-wrap items-center gap-y-1">
            {policyLinks.map((l, i) => (
              <li key={l.href} className="flex items-center">
                {i > 0 && <span aria-hidden className="mx-2.5 h-2.5 w-px bg-foreground/25" />}
                <a
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={i === 0 ? "font-semibold text-foreground hover:underline" : "hover:text-foreground hover:underline"}
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <p className="tracking-wide text-muted-foreground">
            © 2026 Team Stay-Sync, Kyungbok University. All Rights Reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
