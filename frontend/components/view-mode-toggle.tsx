"use client"

import type { ViewMode } from "@/lib/tourism-data"
import { cn } from "@/lib/utils"

const OPTIONS: { value: ViewMode; label: string }[] = [
  { value: "tour", label: "관광지만" },
  { value: "all", label: "전체" },
]

export function ViewModeToggle({ value, onChange }: { value: ViewMode; onChange: (mode: ViewMode) => void }) {
  return (
    <div role="group" aria-label="보기 범위" className="flex items-center gap-4 text-sm">
      {OPTIONS.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "border-b pb-0.5 transition-colors",
              active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        )
      })}
      <span className="text-xs text-muted-foreground">
        {value === "tour" ? "쇼핑·골프장·교통·영화관 제외" : "검색량 전체 기준"}
      </span>
    </div>
  )
}
