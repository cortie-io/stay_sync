import { ArrowDown, ArrowUp, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

export function TrendBadge({ trend, className }: { trend: number; className?: string }) {
  if (trend > 0) {
    return (
      <span className={cn("inline-flex items-center gap-0.5 text-xs font-bold text-highlight", className)}>
        <ArrowUp className="size-3" aria-hidden />
        {trend}
        <span className="sr-only">계단 상승</span>
      </span>
    )
  }
  if (trend < 0) {
    return (
      <span className={cn("inline-flex items-center gap-0.5 text-xs font-bold text-muted-foreground", className)}>
        <ArrowDown className="size-3" aria-hidden />
        {Math.abs(trend)}
        <span className="sr-only">계단 하락</span>
      </span>
    )
  }
  return (
    <span className={cn("inline-flex items-center text-xs text-muted-foreground", className)}>
      <Minus className="size-3" aria-hidden />
      <span className="sr-only">변동 없음</span>
    </span>
  )
}
