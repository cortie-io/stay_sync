"use client"

import { BedDouble, CalendarDays, MapPin, RotateCcw, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { cn, koTracking } from "@/lib/utils"
import {
  COMPANIONS,
  DURATIONS,
  FIXED_START_LOCATION,
  searchAccommodations,
  searchStartLocations,
  todayText,
  type Companion,
  type DurationId,
  type StartLocation,
} from "@/lib/planner"

export function DurationTabs({ value, onChange }: { value: DurationId; onChange: (id: DurationId) => void }) {
  return (
    <div role="radiogroup" aria-label="여행 기간" className="scrollbar-none flex gap-5 overflow-x-auto md:flex-wrap md:gap-y-1 md:overflow-visible">
      {DURATIONS.map((d) => {
        const active = d.id === value
        return (
          <button
            key={d.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(d.id)}
            className={cn(
              "shrink-0 border-b py-1.5 text-sm tracking-wide transition-colors",
              active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {d.label}
          </button>
        )
      })}
    </div>
  )
}

// 핀 아이콘처럼 보이는 숨은 버튼 — 누르면 킨텍스 고정을 풀거나 다시 고정한다.
function HiddenLockToggle({ locked, onToggle }: { locked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={locked ? "출발지 고정 풀기" : "출발지를 킨텍스로 다시 고정"}
      className="shrink-0 cursor-default text-accent focus-visible:outline-none"
    >
      <MapPin className="size-4" strokeWidth={1.25} aria-hidden />
    </button>
  )
}

// 출발지(숙소) 검색 — 카카오 장소 검색 자동완성. 정하면 매일 이곳에서 출발하고 마지막 날 전까지 이곳으로 돌아온다.
function StartLocationField({
  value,
  onChange,
  locked,
  onToggleLock,
}: {
  value: StartLocation | null
  onChange: (v: StartLocation | null) => void
  locked: boolean
  onToggleLock: () => void
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<StartLocation[]>([])
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      searchStartLocations(q, controller.signal).then(setResults).catch(() => {})
    }, 220)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [])

  if (locked) {
    return (
      <div className="flex min-w-0 items-center gap-2 border-b border-foreground py-1.5 text-sm">
        <HiddenLockToggle locked onToggle={onToggleLock} />
        <span className="truncate" title={FIXED_START_LOCATION.address ?? undefined}>
          {FIXED_START_LOCATION.name}
        </span>
      </div>
    )
  }

  if (value) {
    return (
      <div className="flex min-w-0 items-center gap-2 border-b border-foreground py-1.5 text-sm">
        <HiddenLockToggle locked={false} onToggle={onToggleLock} />
        <span className="truncate" title={value.address ?? undefined}>
          {value.name}
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="출발지 지우기"
          className="ml-auto text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
    )
  }

  return (
    <div ref={boxRef} className="relative min-w-0">
      <div className="flex items-center gap-2 border-b border-input py-1.5 text-sm focus-within:border-foreground">
        <HiddenLockToggle locked={false} onToggle={onToggleLock} />
        <label htmlFor="planner-start-location" className="sr-only">
          출발지 또는 숙소
        </label>
        <input
          id="planner-start-location"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="숙소·출발지 (선택)"
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </div>
      {open && results.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-[1200] mt-1 max-h-64 overflow-y-auto border border-border bg-background shadow-lg">
          {results.map((r) => (
            <li key={`${r.name}-${r.mapx}`}>
              <button
                type="button"
                onClick={() => {
                  onChange(r)
                  setQuery("")
                  setOpen(false)
                }}
                className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left text-sm hover:bg-muted"
              >
                <span>{r.name}</span>
                <span className="truncate text-xs text-muted-foreground">{r.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FieldLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("text-[11px] uppercase tracking-[0.28em] text-muted-foreground", koTracking(children), className)}>{children}</span>
}

// 동행자 유형 — 한 번 더 누르면 선택을 푼다.
function CompanionChips({ value, onChange }: { value: Companion | null; onChange: (v: Companion | null) => void }) {
  return (
    <div role="radiogroup" aria-label="동행자" className="scrollbar-none flex gap-1.5 overflow-x-auto md:flex-wrap md:overflow-visible">
      {COMPANIONS.map((c) => {
        const active = c.id === value
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(active ? null : c.id)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs tracking-wide transition-colors",
              active ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
            )}
          >
            {c.label}
          </button>
        )
      })}
    </div>
  )
}

// 숙소 검색 — 카카오 장소 검색에서 숙박 업소만. 정하면 첫날은 숙소에서 마치고, 둘째 날부터 숙소에서 출발한다.
function AccommodationField({
  value,
  onChange,
  disabled,
}: {
  value: StartLocation | null
  onChange: (v: StartLocation | null) => void
  disabled: boolean
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<StartLocation[]>([])
  const [searched, setSearched] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setSearched(false)
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      searchAccommodations(q, controller.signal)
        .then((items) => {
          setResults(items)
          setSearched(true)
        })
        .catch(() => {})
    }, 220)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [])

  if (disabled) {
    return (
      <div className="flex min-w-0 items-center gap-2 border-b border-input py-1.5 text-sm text-muted-foreground">
        <BedDouble className="size-4 shrink-0" strokeWidth={1.25} aria-hidden />
        <span className="truncate">당일치기는 숙소 없이 출발지로 돌아와요</span>
      </div>
    )
  }

  if (value) {
    return (
      <div className="flex min-w-0 items-center gap-2 border-b border-foreground py-1.5 text-sm">
        <BedDouble className="size-4 shrink-0 text-accent" strokeWidth={1.25} aria-hidden />
        <span className="truncate" title={value.address ?? undefined}>
          {value.name}
        </span>
        <button type="button" onClick={() => onChange(null)} aria-label="숙소 지우기" className="ml-auto text-muted-foreground hover:text-foreground">
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
    )
  }

  return (
    <div ref={boxRef} className="relative min-w-0">
      <div className="flex items-center gap-2 border-b border-input py-1.5 text-sm focus-within:border-foreground">
        <BedDouble className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.25} aria-hidden />
        <label htmlFor="planner-accommodation" className="sr-only">
          숙소
        </label>
        <input
          id="planner-accommodation"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="숙소 이름 검색 (선택)"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </div>
      {open && (results.length > 0 || searched) && (
        <ul className="absolute left-0 right-0 top-full z-[1200] mt-1 max-h-64 overflow-y-auto border border-border bg-background shadow-lg">
          {results.length === 0 && <li className="px-3 py-2.5 text-xs text-muted-foreground">검색된 숙소가 없어요. 다른 이름으로 찾아보세요.</li>}
          {results.map((r) => (
            <li key={`${r.name}-${r.mapx}`}>
              <button
                type="button"
                onClick={() => {
                  onChange(r)
                  setQuery("")
                  setOpen(false)
                }}
                className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left text-sm hover:bg-muted"
              >
                <span>{r.name}</span>
                <span className="truncate text-xs text-muted-foreground">{r.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function TripSettings({
  durationId,
  onDurationChange,
  startDate,
  onStartDateChange,
  startLocation,
  onStartLocationChange,
  originLocked,
  onToggleOriginLock,
  accommodation,
  onAccommodationChange,
  companion,
  onCompanionChange,
  onReset,
  canReset = true,
}: {
  durationId: DurationId
  onDurationChange: (id: DurationId) => void
  startDate: string
  onStartDateChange: (date: string) => void
  startLocation: StartLocation | null
  onStartLocationChange: (v: StartLocation | null) => void
  originLocked: boolean
  onToggleOriginLock: () => void
  accommodation: StartLocation | null
  onAccommodationChange: (v: StartLocation | null) => void
  companion: Companion | null
  onCompanionChange: (v: Companion | null) => void
  // 여행 조건과 목록 필터를 처음 상태로 (담은 여행지는 그대로)
  onReset?: () => void
  canReset?: boolean
}) {
  const dayTrip = DURATIONS.find((d) => d.id === durationId)?.days === 1
  return (
    // 여행 조건을 한 패널로 묶는다. 폭은 화면이 아니라 패널 자신의 너비로 나눈다(AI 패널을 펼쳐 가운데가 좁아져도 깨지지 않게).
    <section aria-label="여행 조건" className="@container rounded-sm border border-border">
      <div className="grid grid-cols-1 gap-x-8 gap-y-5 px-5 py-4 @xl:grid-cols-2 @5xl:grid-cols-[auto_minmax(9.5rem,10.5rem)_minmax(0,1fr)_minmax(0,1fr)] @5xl:items-end">
        <div className="flex min-w-0 flex-col gap-1.5">
          <FieldLabel>기간</FieldLabel>
          <DurationTabs value={durationId} onChange={onDurationChange} />
        </div>
        <label className="flex min-w-0 flex-col gap-1.5">
          <FieldLabel>출발일</FieldLabel>
          <span className="flex items-center gap-2 border-b border-input py-1.5 text-sm focus-within:border-foreground">
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.25} aria-hidden />
            <input
              type="date"
              value={startDate}
              min={todayText()}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="min-w-0 flex-1 bg-transparent outline-none"
            />
          </span>
        </label>
        <div className="flex min-w-0 flex-col gap-1.5">
          <FieldLabel>출발지</FieldLabel>
          <StartLocationField
            value={startLocation}
            onChange={onStartLocationChange}
            locked={originLocked}
            onToggleLock={onToggleOriginLock}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <FieldLabel>숙소</FieldLabel>
          <AccommodationField value={accommodation} onChange={onAccommodationChange} disabled={dayTrip} />
        </div>
      </div>
      <div className="flex flex-col gap-2 border-t border-border px-5 py-3 @xl:flex-row @xl:items-center @xl:gap-6">
        <FieldLabel className="@xl:w-10 @xl:shrink-0">동행</FieldLabel>
        <CompanionChips value={companion} onChange={onCompanionChange} />
        <div className="flex items-center gap-5 @xl:ml-auto">
          <span className="hidden text-xs text-muted-foreground @4xl:inline">고르면 잘 맞는 여행지에 추천 표시가 붙어요</span>
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              disabled={!canReset}
              title="기간·출발일·출발지·숙소·동행과 지역·테마·검색을 처음 상태로 돌려요. 담은 여행지는 그대로예요."
              className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              조건 초기화
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
