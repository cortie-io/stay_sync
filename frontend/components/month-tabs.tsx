"use client"

import { months } from "@/lib/tourism-data"
import { cn } from "@/lib/utils"

export function MonthTabs({
  value,
  onChange,
  className,
}: {
  value: number
  onChange: (month: number) => void
  className?: string
}) {
  return (
    <div role="group" aria-label="월 선택" className={cn("scrollbar-none -mx-2.5 flex overflow-x-auto", className)}>
      {months.map((m, i) => {
        const active = i === value
        return (
          <button
            key={m}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(i)}
            className={cn(
              "relative shrink-0 px-2.5 py-2 text-sm tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {m}
            <span
              aria-hidden
              className={cn(
                "absolute inset-x-2.5 bottom-0 h-px bg-foreground transition-opacity",
                active ? "opacity-100" : "opacity-0",
              )}
            />
          </button>
        )
      })}
    </div>
  )
}
