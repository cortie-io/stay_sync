"use client"

import { Check, Plus, Search } from "lucide-react"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import {
  COMPANION_THEMES,
  PLANNER_REGIONS,
  PLANNER_THEMES,
  companionLabel,
  fetchDestinations,
  formatId,
  type Companion,
  type Destination,
} from "@/lib/planner"
import { SafeImage } from "@/components/safe-image"

function Chips({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { id: string; label: string }[]
  value: string
  onChange: (id: string) => void
}) {
  return (
    // 모바일은 옆으로 밀어 보고, 그보다 넓은 화면은 줄바꿈해 모든 칩이 보이게 한다(숨은 가로 스크롤은 마우스로 넘기기 어렵다).
    <div role="radiogroup" aria-label={label} className="scrollbar-none -mx-1 flex gap-1 overflow-x-auto md:flex-wrap md:overflow-visible">
      {options.map((o) => {
        const active = o.id === value
        return (
          <button
            key={o.id || "all"}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.id)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1 text-xs tracking-wide transition-colors",
              active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

const REGION_OPTIONS = [{ id: "", label: "전체 지역" }, ...PLANNER_REGIONS.map((r) => ({ id: r, label: r }))]
const THEME_OPTIONS = [{ id: "", label: "모든 테마" }, ...PLANNER_THEMES]

// 여행지 목록 — 백엔드에서 지역·테마·검색어별 인기순(2025년 검색량)으로 받아 온다.
export function DestinationBrowser({
  region,
  onRegionChange,
  selectedIds,
  onToggle,
  onOpen,
  companion = null,
  onFilterActiveChange,
}: {
  region: string
  onRegionChange: (region: string) => void
  selectedIds: number[]
  onToggle: (destination: Destination) => void
  onOpen: (destination: Destination) => void
  // 고른 동행자에게 잘 맞는 테마면 "OO 추천"을 붙인다.
  companion?: Companion | null
  // 테마·검색어가 걸려 있는지 알려 준다(조건 초기화 버튼 활성화용)
  onFilterActiveChange?: (active: boolean) => void
}) {
  const companionThemes = companion ? COMPANION_THEMES[companion] : []
  const [theme, setTheme] = useState("")
  const [query, setQuery] = useState("")
  const [items, setItems] = useState<Destination[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const q = query.trim()

  useEffect(() => {
    onFilterActiveChange?.(Boolean(theme || q))
  }, [theme, q, onFilterActiveChange])

  useEffect(() => {
    const controller = new AbortController()
    setItems(null)
    const timer = window.setTimeout(
      () => {
        setError(null)
        fetchDestinations({ region, query: q, theme }, controller.signal)
          .then(setItems)
          .catch((e: Error) => {
            if (e.name !== "AbortError") setError("여행지 목록을 불러오지 못했어요.")
          })
      },
      q ? 250 : 0,
    )
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [region, theme, q])

  return (
    <div className="flex flex-col gap-3 lg:min-h-0 lg:flex-1">
      <Chips label="지역" options={REGION_OPTIONS} value={region} onChange={onRegionChange} />
      <Chips label="테마" options={THEME_OPTIONS} value={theme} onChange={setTheme} />
      <label className="relative block">
        <span className="sr-only">여행지 검색</span>
        <Search
          className="pointer-events-none absolute left-0 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.25}
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`${region || "경기북부"} 여행지 이름으로 검색`}
          className="h-11 w-full border-b border-input bg-transparent pl-7 pr-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-foreground"
        />
      </label>

      <ul className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto" aria-label="여행지 목록" aria-busy={items === null}>
        {error && <li className="py-12 text-center text-sm text-destructive">{error}</li>}
        {!error &&
          items === null &&
          Array.from({ length: 5 }, (_, i) => (
            <li key={i} className="flex items-center gap-5 border-b border-border py-3.5" aria-hidden>
              <span className="w-6" />
              <span className="size-14 shrink-0 animate-pulse rounded-sm bg-muted" />
              <span className="flex flex-1 flex-col gap-2">
                <span className="h-3.5 w-1/3 animate-pulse rounded-sm bg-muted" />
                <span className="h-3 w-1/4 animate-pulse rounded-sm bg-muted" />
              </span>
            </li>
          ))}
        {!error && items?.length === 0 && (
          <li className="py-12 text-center text-sm text-muted-foreground">
            {q ? `'${q}'에 대한 검색 결과가 없습니다.` : "조건에 맞는 여행지가 없어요. 테마나 지역을 바꿔 보세요."}
          </li>
        )}
        {items?.map((d, i) => {
          const order = selectedIds.indexOf(d.id)
          const checked = order !== -1
          return (
            <li key={d.id} className="flex items-center gap-4 border-b border-border py-3 last:border-b-0 md:gap-5">
              <span className="w-6 shrink-0 font-serif text-xs tabular-nums text-muted-foreground">{formatId(i + 1)}</span>
              {/* 줄을 누르면 바로 담고(다시 누르면 빼고), 오른쪽 + 버튼은 상세 화면을 연다. */}
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => onToggle(d)}
                className="group flex min-w-0 flex-1 items-center gap-4 text-left md:gap-5"
              >
                <span className="relative size-14 shrink-0 overflow-hidden rounded-sm bg-muted">
                  <SafeImage
                    src={d.image || "/placeholder.svg"}
                    fallback="/placeholder.svg"
                    alt=""
                    fill
                    sizes="56px"
                    className={cn(
                      "object-cover transition-[filter,transform] duration-500 group-hover:scale-105",
                      !checked && "grayscale-[35%]",
                    )}
                  />
                  {checked && (
                    <span className="absolute inset-0 flex items-center justify-center bg-accent/70 text-accent-foreground">
                      <Check className="size-5" aria-hidden />
                    </span>
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className={cn("truncate font-serif text-[15px]", checked ? "text-accent" : "text-foreground group-hover:text-accent")}>
                    {d.name}
                  </span>
                  <span className="truncate text-xs tracking-wide text-muted-foreground">
                    {[d.region, d.tag, d.indoorOutdoor].filter(Boolean).join(" · ")}
                    {d.theme && companionThemes.includes(d.theme) && <span className="text-accent">{` · ${companionLabel(companion)} 추천`}</span>}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => onOpen(d)}
                aria-label={`${d.name} 상세 보기`}
                title="상세 보기"
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border font-serif text-xs tabular-nums transition-colors",
                  checked
                    ? "border-accent bg-accent text-accent-foreground hover:bg-accent/85"
                    : "border-input text-muted-foreground hover:border-foreground hover:text-foreground",
                )}
              >
                {checked ? order + 1 : <Plus className="size-3.5" aria-hidden />}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function AddButton({ added, onClick, className }: { added: boolean; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-sm px-5 text-[13px] tracking-wide transition-colors",
        added ? "border border-accent text-accent hover:bg-accent/10" : "bg-primary text-primary-foreground hover:opacity-85",
        className,
      )}
    >
      {added ? <Check className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
      {added ? "담았어요 · 빼기" : "여행에 담기"}
    </button>
  )
}
