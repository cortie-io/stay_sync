import { cn } from "@/lib/utils"

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-xs uppercase tracking-[0.3em] text-muted-foreground", className)}>{children}</p>
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  id: string
  eyebrow: string
  title: string
  description?: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
      <div className="flex flex-col gap-3">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 id={id} className="font-serif text-3xl leading-tight text-balance md:text-4xl">
          {title}
        </h2>
        {description && <p className="leading-relaxed text-muted-foreground text-pretty">{description}</p>}
      </div>
      {children && <div className="min-w-0">{children}</div>}
    </div>
  )
}

export function pad2(n: number) {
  return String(n).padStart(2, "0")
}
