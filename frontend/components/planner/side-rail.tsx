"use client"

import { X } from "lucide-react"
import type { Destination } from "@/lib/planner"
import { SafeImage } from "@/components/safe-image"

export function SideRail({
  selected,
  onRemove,
  onOpen,
}: {
  selected: Destination[]
  onRemove: (id: number) => void
  onOpen: (d: Destination) => void
}) {
  return (
    <aside
      aria-label="내가 고른 여행지"
      className="hidden w-20 shrink-0 flex-col items-center gap-4 border-r border-border bg-sidebar py-6 md:flex"
    >
      <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Picks</p>
      <ul className="flex flex-1 flex-col items-center gap-4 overflow-y-auto px-2 pb-2">
        {selected.length === 0 && (
          <li className="text-center text-[11px] leading-relaxed text-muted-foreground">선택 없음</li>
        )}
        {selected.map((d, i) => (
          <li key={d.id} className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={() => onOpen(d)}
              title={d.name}
              className="group relative block size-12 overflow-hidden rounded-sm bg-muted"
            >
              <SafeImage
                src={d.image || "/placeholder.svg"}
                fallback="/placeholder.svg"
                alt={d.name}
                fill
                sizes="48px"
                className="object-cover"
              />
            </button>
            <button
              type="button"
              onClick={() => onRemove(d.id)}
              aria-label={`${d.name} 빼기`}
              className="-mt-3 ml-9 grid size-4 place-items-center rounded-full bg-foreground text-background opacity-70 hover:opacity-100"
            >
              <X className="size-2.5" strokeWidth={2} aria-hidden />
            </button>
            <span className="font-serif text-[11px] tabular-nums text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
          </li>
        ))}
      </ul>
    </aside>
  )
}
