"use client"

import QRCode from "qrcode"
import { Check, Copy, Download, Link2, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"

// 공유 링크 + QR — 휴대폰 카메라로 찍으면 같은 일정이 바로 열린다. QR은 브라우저에서 바로 그린다(외부 서비스 없음).
function useShareQr(url: string, title: string) {
  const [svg, setSvg] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1c1a19", light: "#ffffff" } })
      .then(setSvg)
      .catch(() => setSvg(null))
  }, [url])

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  async function download() {
    try {
      const dataUrl = await QRCode.toDataURL(url, { width: 720, margin: 2, errorCorrectionLevel: "M" })
      const link = document.createElement("a")
      link.href = dataUrl
      link.download = `${title.replace(/[\\/:*?"<>|\s]+/g, "_")}_QR.png`
      link.click()
    } catch {}
  }

  return { svg, copied, copy, download }
}

export function ShareCard({ url, title }: { url: string; title: string }) {
  const { svg, copied, copy, download } = useShareQr(url, title)

  return (
    <section aria-label="일정 공유" className="flex flex-col gap-5 rounded-sm border border-border p-5 sm:flex-row sm:items-center">
      <div
        className="size-36 shrink-0 self-center rounded-sm border border-border bg-white p-1 sm:self-auto [&>svg]:size-full"
        role="img"
        aria-label="일정 공유 QR 코드"
        dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.28em] text-accent">Share</span>
          <p className="font-serif text-lg">휴대폰으로 찍어 바로 열어 보세요</p>
          <p className="text-xs text-muted-foreground">QR을 찍거나 링크를 보내면 누구나 같은 일정을 볼 수 있어요.</p>
        </div>
        <p className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <Link2 className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{url}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copy}
            className="inline-flex h-9 items-center gap-2 rounded-sm border border-accent px-3 text-[13px] text-accent hover:bg-accent/10"
          >
            {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
            {copied ? "복사했어요" : "링크 복사"}
          </button>
          <button
            type="button"
            onClick={download}
            className="inline-flex h-9 items-center gap-2 rounded-sm border border-border px-3 text-[13px] hover:border-foreground"
          >
            <Download className="size-4" aria-hidden />
            QR 저장
          </button>
        </div>
      </div>
    </section>
  )
}

// 저장 직후 뜨는 공유 팝업 — 위에 QR, 아래에 링크.
export function ShareDialog({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const { svg, copied, copy, download } = useShareQr(url, title)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-5" role="presentation">
      <div className="absolute inset-0 bg-foreground/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-dialog-title"
        className="relative flex w-full max-w-sm flex-col items-center gap-5 rounded-sm bg-background p-6 shadow-xl"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-3 top-3 grid size-8 place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" aria-hidden />
        </button>
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-[10px] uppercase tracking-[0.28em] text-accent">Saved</span>
          <h2 id="share-dialog-title" className="font-serif text-xl">
            일정을 저장했어요
          </h2>
          <p className="text-xs text-muted-foreground">휴대폰 카메라로 QR을 찍으면 같은 일정이 바로 열려요.</p>
        </div>
        <div
          className="size-56 rounded-sm border border-border bg-white p-2 [&>svg]:size-full"
          role="img"
          aria-label="일정 공유 QR 코드"
          dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
        />
        <div className="flex w-full min-w-0 items-center gap-2 rounded-sm border border-border bg-muted/40 px-3 py-2.5 text-xs">
          <Link2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <a href={url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate hover:underline">
            {url}
          </a>
        </div>
        <div className="grid w-full grid-cols-2 gap-2">
          <button
            type="button"
            onClick={copy}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-sm bg-primary text-[13px] text-primary-foreground hover:opacity-85"
          >
            {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
            {copied ? "복사했어요" : "링크 복사"}
          </button>
          <button
            type="button"
            onClick={download}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-sm border border-border text-[13px] hover:border-foreground"
          >
            <Download className="size-4" aria-hidden />
            QR 저장
          </button>
        </div>
      </div>
    </div>
  )
}
