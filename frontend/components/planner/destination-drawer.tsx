"use client"

import { ExternalLink, Phone, Plus, X, Check } from "lucide-react"
import { useEffect, useState } from "react"
import { fetchAttractionInfo, type AttractionExtraInfo, type Destination } from "@/lib/planner"
import { SafeImage } from "@/components/safe-image"
import { AddButton } from "./destination-browser"

// 여행지 상세 — 관광공사 소개·이용 안내·사진, 검색이 많은 달, 주변에 함께 갈 곳
export function DestinationDrawer({
  destination,
  selectedIds,
  onToggle,
  onOpen,
  onClose,
}: {
  destination: Destination
  selectedIds: number[]
  onToggle: (d: Destination) => void
  onOpen: (d: Destination) => void
  onClose: () => void
}) {
  const [info, setInfo] = useState<AttractionExtraInfo | null>(null)
  const [imageIndex, setImageIndex] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setInfo(null)
    setImageIndex(0)
    fetchAttractionInfo(destination.id, controller.signal).then(setInfo).catch(() => {})
    return () => controller.abort()
  }, [destination.id])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const images = [destination.image, ...(info?.images ?? [])].filter((src, i, all): src is string => !!src && all.indexOf(src) === i)
  const peakMonths = [...(info?.monthly ?? [])]
    .filter((m) => m.searchCount > 0)
    .sort((a, b) => b.searchCount - a.searchCount)
    .slice(0, 3)
    .map((m) => `${m.month}월`)
  const facts = [...(info?.intro ?? []), ...(info?.info ?? [])].slice(0, 8)
  const added = selectedIds.includes(destination.id)

  return (
    <div className="fixed inset-0 z-[1100] flex justify-end" role="presentation">
      <button type="button" aria-label="닫기" onClick={onClose} className="absolute inset-0 bg-foreground/40" />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`${destination.name} 상세`}
        className="relative flex h-full w-full max-w-lg flex-col overflow-hidden bg-background shadow-2xl"
      >
        <div className="relative aspect-[16/10] shrink-0 bg-muted">
          {images[imageIndex] && (
            <SafeImage src={images[imageIndex]} fallback="/placeholder.svg" alt={destination.name} fill sizes="512px" className="object-cover" />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="상세 닫기"
            className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-background/90 text-foreground"
          >
            <X className="size-5" aria-hidden />
          </button>
          {images.length > 1 && (
            <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
              {images.slice(0, 10).map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setImageIndex(i)}
                  aria-label={`사진 ${i + 1}`}
                  className={`size-2 rounded-full ${i === imageIndex ? "bg-background" : "bg-background/50"}`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
          <div className="flex flex-col gap-2">
            <span className="text-[10px] uppercase tracking-[0.28em] text-accent">
              {[destination.region, destination.tag].filter(Boolean).join(" · ")}
            </span>
            <h2 className="font-serif text-3xl leading-tight">{destination.name}</h2>
            {info?.address && <p className="text-sm text-muted-foreground">{info.address}</p>}
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
            {destination.indoorOutdoor && <span>{destination.indoorOutdoor}</span>}
            {peakMonths.length > 0 && <span>{`많이 찾는 달 · ${peakMonths.join(", ")}`}</span>}
            {info?.tel && (
              <span className="inline-flex items-center gap-1">
                <Phone className="size-3" aria-hidden />
                {info.tel}
              </span>
            )}
            {info?.homepage && (
              <a href={info.homepage} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground">
                홈페이지 <ExternalLink className="size-3" aria-hidden />
              </a>
            )}
          </div>

          {info && !info.description && facts.length === 0 && images.length <= 1 && (
            <p className="rounded-sm bg-muted px-4 py-3 text-sm text-muted-foreground">
              관광공사 상세 정보를 지금은 불러올 수 없어요. 잠시 뒤 다시 열어 보세요.
            </p>
          )}

          {info === null ? (
            <div className="flex flex-col gap-2" aria-hidden>
              {Array.from({ length: 4 }, (_, i) => (
                <span key={i} className="h-3.5 animate-pulse rounded-sm bg-muted" style={{ width: `${90 - i * 12}%` }} />
              ))}
            </div>
          ) : (
            info.description && (
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/85">
                {info.description.length > 420 ? `${info.description.slice(0, 420)}…` : info.description}
              </p>
            )
          )}

          {facts.length > 0 && (
            <dl className="border-t border-border text-sm">
              {facts.map((f, i) => (
                <div key={`${f.label}-${i}`} className="grid grid-cols-[6.5rem_1fr] gap-3 border-b border-border py-2.5">
                  <dt className="text-muted-foreground">{f.label}</dt>
                  <dd className="whitespace-pre-line [overflow-wrap:anywhere]">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {info && info.nearby.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">가까이 함께 가기 좋은 곳</h3>
              <ul className="border-t border-border">
                {info.nearby.slice(0, 5).map((n) => {
                  const nearbyDestination: Destination = {
                    id: n.id,
                    name: n.title,
                    region: n.region,
                    tag: n.type || "관광지",
                    lat: n.mapy,
                    lng: n.mapx,
                    image: n.image,
                  }
                  const inPlan = selectedIds.includes(n.id)
                  return (
                    <li key={n.id} className="flex items-center gap-3 border-b border-border py-2.5">
                      <button type="button" onClick={() => onOpen(nearbyDestination)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        <span className="relative size-10 shrink-0 overflow-hidden rounded-sm bg-muted">
                          <SafeImage src={n.image || "/placeholder.svg"} fallback="/placeholder.svg" alt="" fill sizes="40px" className="object-cover" />
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-sm hover:text-accent">{n.title}</span>
                          <span className="text-[11px] text-muted-foreground">{`${n.type ?? "관광지"} · ${n.distanceKm}km`}</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggle(nearbyDestination)}
                        aria-label={inPlan ? `${n.title} 빼기` : `${n.title} 담기`}
                        className={`grid size-7 shrink-0 place-items-center rounded-full border ${inPlan ? "border-accent bg-accent text-accent-foreground" : "border-input text-muted-foreground hover:border-foreground"}`}
                      >
                        {inPlan ? <Check className="size-3.5" aria-hidden /> : <Plus className="size-3.5" aria-hidden />}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">정보 출처 · 한국관광공사 TourAPI</p>
        </div>

        <div className="shrink-0 border-t border-border p-4">
          <AddButton added={added} onClick={() => onToggle(destination)} className="w-full" />
        </div>
      </section>
    </div>
  )
}
