"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Check, MousePointerClick, Sparkles, X } from "lucide-react"
import { INITIAL_MESSAGE, toChatPlan, type ChatMessage, type Recommendation } from "@/lib/concierge-chat"

/**
 * 전시(키오스크) 모드 — 원래 사이트 화면 그대로 쓰되,
 * 평소에는 AI 컨시어지가 녹화된 대화를 자동으로 재생하고(뒤 화면도 천천히 스크롤),
 * 누군가 만지면 그 자리에서 직접 쓰게 하고, 한동안 아무도 안 쓰면 대화를 지우고 다시 시연으로 돌아간다.
 *
 * 켜기: 주소에 ?kiosk=1 (이 탭이 닫힐 때까지 유지), 끄기: ?kiosk=0
 * 단축키: Ctrl+Shift+K (Mac ⌘+Shift+K) — 언제든 대화를 지우고 자동 시연으로 바로 돌아간다(스태프용)
 *
 * 2026-10-08: 대기 화면은 홍보 영상(public/kiosk/attract.mp4)을 전체 화면으로 반복 재생한다(소리 켬 — 막히면 소리 없이, 키를 한 번 누르면 소리).
 * 영상을 못 불러오면 예전 방식(녹화된 대화 재생 + 왼쪽 설명 패널)으로 돌아간다. 영상 바꾸기: 그 파일만 교체 후 다시 배포.
 */
const ATTRACT_VIDEO = "/kiosk/attract.mp4"

const FLAG_KEY = "stay-sync.kiosk"
// QR은 지금 열려 있는 사이트 주소로 만든다(서버에서 그릴 때만 기본 주소)
export function kioskShareOrigin() {
  return typeof window === "undefined" ? "https://kbu.stay-sync.cortie.io" : window.location.origin
}
const IDLE_WARN_MS = 60_000
const IDLE_RESET_S = 15

type Mode = "off" | "attract" | "live"
type KioskContextValue = {
  enabled: boolean
  mode: Mode
  startLive: () => void
  goAttract: () => void
  setBusy: (busy: boolean) => void
  resetToken: number
  demo: KioskDemoView
}

const KioskContext = createContext<KioskContextValue>({
  enabled: false, mode: "off", startLive: () => {}, goAttract: () => {}, setBusy: () => {}, resetToken: 0,
  demo: { messages: [], typing: "", thinking: false, selectedIds: [], step: "ASK_SERVICE_TYPE", example: null, mapUrl: null },
})

export function useKiosk() {
  return useContext(KioskContext)
}

export function KioskProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [enabled, setEnabled] = useState(false)
  const [mode, setMode] = useState<Mode>("off")
  const [warn, setWarn] = useState<number | null>(null)
  const [resetToken, setResetToken] = useState(0)
  // 전시 PC에서는 새 창을 못 쓰게 하므로, 카카오맵 길찾기는 화면 안 창으로 연다
  const [mapUrl, setMapUrl] = useState<string | null>(null)
  const lastInput = useRef(Date.now())
  const busy = useRef(false)
  // 대기 영상을 쓸 수 있으면 영상, 아니면 녹화된 대화 시연
  const [videoOk, setVideoOk] = useState(true)
  // 자동 시연 상태는 챗봇 창과 왼쪽 설명 패널이 함께 쓴다(영상을 쓰는 동안은 돌리지 않는다)
  const demo = useKioskDemo(enabled && mode === "attract" && !videoOk)

  // 켜고 끄기 (주소 → 이 탭의 sessionStorage)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("kiosk")
    try {
      if (q === "1") window.sessionStorage.setItem(FLAG_KEY, "1")
      if (q === "0") window.sessionStorage.removeItem(FLAG_KEY)
      const on = window.sessionStorage.getItem(FLAG_KEY) === "1"
      setEnabled(on)
      setMode((m) => (on ? (m === "off" ? (window.location.pathname === "/" ? "attract" : "live") : m) : "off"))
    } catch {}
  }, [pathname])

  const startLive = useCallback(() => {
    lastInput.current = Date.now()
    setWarn(null)
    setMode("live")
  }, [])

  const goAttract = useCallback(() => {
    setWarn(null)
    setMapUrl(null)
    setResetToken((t) => t + 1) // 챗봇이 대화를 지운다
    setMode("attract")
    if (window.location.pathname !== "/") router.push("/")
    window.scrollTo({ top: 0 })
  }, [router])

  const setBusy = useCallback((value: boolean) => {
    busy.current = value
    if (value) lastInput.current = Date.now()
  }, [])

  // 스태프용 단축키: Ctrl+Shift+K / ⌘+Shift+K → 바로 자동 시연으로
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault()
        goAttract()
      }
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [enabled, goAttract])

  // 입력 감지
  useEffect(() => {
    if (!enabled) return
    const touch = () => {
      lastInput.current = Date.now()
      setWarn(null)
    }
    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const
    events.forEach((ev) => window.addEventListener(ev, touch, { passive: true }))
    return () => events.forEach((ev) => window.removeEventListener(ev, touch))
  }, [enabled])

  // 한동안 아무도 없으면: 경고 → 초기화
  useEffect(() => {
    if (mode !== "live") return
    const timer = setInterval(() => {
      if (busy.current) lastInput.current = Date.now()
      const idle = Date.now() - lastInput.current
      if (idle > IDLE_WARN_MS + IDLE_RESET_S * 1000) goAttract()
      else if (idle > IDLE_WARN_MS) setWarn(Math.ceil((IDLE_WARN_MS + IDLE_RESET_S * 1000 - idle) / 1000))
      else setWarn(null)
    }, 500)
    return () => clearInterval(timer)
  }, [mode, goAttract])

  // 전시 PC 보호: 화면 꺼짐 방지, 우클릭 막기, 바깥 사이트로 나가는 링크 막기
  useEffect(() => {
    if (!enabled) return
    type Lock = { release: () => Promise<void> }
    let lock: Lock | null = null
    const request = async () => {
      try {
        const wl = (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<Lock> } }).wakeLock
        lock = wl ? await wl.request("screen") : null
      } catch {}
    }
    request()
    const onVisible = () => { if (document.visibilityState === "visible") request() }
    const noMenu = (e: Event) => e.preventDefault()
    const noExternal = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a")
      if (!a) return
      const href = a.getAttribute("href") || ""
      if (/^https:\/\/map\.kakao\.com\//.test(href)) {
        e.preventDefault()
        setMapUrl(href)
        return
      }
      if (a.target === "_blank" || (/^https?:/.test(href) && !href.startsWith(window.location.origin))) e.preventDefault()
    }
    document.addEventListener("visibilitychange", onVisible)
    document.addEventListener("contextmenu", noMenu)
    document.addEventListener("click", noExternal, true)
    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      document.removeEventListener("contextmenu", noMenu)
      document.removeEventListener("click", noExternal, true)
      lock?.release().catch(() => {})
    }
  }, [enabled])

  // 자동 시연 중에는 링크 미리 불러오기(prefetch)를 막는다 — 배경이 스크롤되며 보이는 링크마다 서버가 페이지를 미리 그리면
  // 관광지 상세(TourAPI 등)를 부를 수 있어서, 사람이 쓰지 않는 동안에는 서버·외부 API를 한 번도 부르지 않게 한다.
  useEffect(() => {
    if (mode !== "attract") return
    const original = window.fetch
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined))
      if (headers.has("next-router-prefetch") || headers.has("next-router-segment-prefetch")) {
        return Promise.reject(new DOMException("prefetch paused in kiosk attract mode", "AbortError"))
      }
      return original(input, init)
    }
    return () => { window.fetch = original }
  }, [mode])

  // 자동 시연 중에는 뒤 화면(홈)을 천천히 내린다 — 푸터가 보이기 직전까지 내려갔다가 부드럽게 맨 위로 돌아와 반복
  useEffect(() => {
    if (mode !== "attract" || videoOk) return
    const SPEED = 45 // px/초
    const RETURN_MS = 2500
    let raf = 0
    let phase: "wait" | "down" | "hold" | "up" = "wait"
    let phaseStart = performance.now()
    let pos = window.scrollY
    let upFrom = 0
    let last = phaseStart
    const bottomLimit = () => {
      const footer = document.querySelector("footer")
      const footerTop = footer ? footer.getBoundingClientRect().top + window.scrollY : document.documentElement.scrollHeight
      return Math.max(0, footerTop - window.innerHeight)
    }
    const step = (now: number) => {
      const dt = Math.min(now - last, 100) / 1000
      last = now
      const elapsed = now - phaseStart
      if (phase === "wait" && elapsed > 3000) { phase = "down"; phaseStart = now; pos = window.scrollY }
      else if (phase === "down") {
        const limit = bottomLimit()
        pos = Math.min(pos + SPEED * dt, limit)
        window.scrollTo(0, pos)
        if (pos >= limit - 1) { phase = "hold"; phaseStart = now }
      } else if (phase === "hold" && elapsed > 3000) { phase = "up"; phaseStart = now; upFrom = window.scrollY }
      else if (phase === "up") {
        const k = Math.min(1, elapsed / RETURN_MS)
        const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
        window.scrollTo(0, upFrom * (1 - ease))
        if (k >= 1) { phase = "wait"; phaseStart = now; pos = 0 }
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [mode, videoOk])

  return (
    <KioskContext.Provider value={{ enabled, mode, startLive, goAttract, setBusy, resetToken, demo }}>
      {children}
      {enabled && mode === "attract" && videoOk && <AttractVideo onStart={startLive} onFail={() => setVideoOk(false)} />}
      {enabled && mode === "attract" && !videoOk && (
        <>
          {/* 시연 중 어디를 눌러도 체험 시작 (챗봇 창은 이 층보다 위에 있어 자체적으로 처리) */}
          <div className="fixed inset-0 z-[45] cursor-none" onPointerDown={startLive} aria-hidden />
          <AttractPanel demo={demo} />
        </>
      )}
      {enabled && mode === "attract" && !videoOk && demo.mapUrl && (
        <div className="kiosk-in fixed inset-0 z-[70] flex flex-col bg-background" onPointerDown={startLive} aria-hidden>
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <p className="flex items-center gap-3">
              <span className="kiosk-live size-2 rounded-full bg-accent" aria-hidden />
              <span className="font-serif text-lg">실제 도로 기준으로 짠 동선 — 카카오맵 길찾기</span>
            </p>
            <p className="text-sm text-muted-foreground">화면을 클릭하면 직접 만들어 볼 수 있어요</p>
          </div>
          <iframe src={demo.mapUrl} title="카카오맵 길찾기" tabIndex={-1} className="pointer-events-none min-h-0 flex-1 border-0" />
        </div>
      )}
      {enabled && mapUrl && (
        <div className="fixed inset-0 z-[1300] flex flex-col bg-background" role="dialog" aria-label="카카오맵 길찾기">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <p className="font-serif text-lg">카카오맵 길찾기</p>
            <button type="button" onClick={() => setMapUrl(null)}
              className="inline-flex h-10 items-center gap-2 bg-primary px-5 text-sm text-primary-foreground">
              <X className="size-4" aria-hidden />닫고 대화로 돌아가기
            </button>
          </div>
          <iframe src={mapUrl} title="카카오맵 길찾기" className="min-h-0 flex-1 border-0" />
        </div>
      )}
      {enabled && mode === "live" && warn !== null && (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-foreground/40 p-5" role="alertdialog" aria-label="처음 화면으로 돌아가요">
          <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-sm bg-background p-8 text-center shadow-xl">
            <p className="text-[12px] uppercase tracking-[0.28em] text-muted-foreground">Still there?</p>
            <p className="font-serif text-2xl">아직 계신가요?</p>
            <p className="text-sm text-muted-foreground">
              <b className="text-foreground">{warn}초</b> 뒤에 처음 화면으로 돌아가요.<br />지금까지의 대화는 지워져요.
            </p>
            <button type="button" onClick={startLive} className="mt-2 h-11 w-full rounded-sm bg-primary text-sm text-primary-foreground">
              계속할게요
            </button>
          </div>
        </div>
      )}
    </KioskContext.Provider>
  )
}

// ---------------------------------------------------------------------------------------------
// 대기 영상 — 전체 화면 반복 재생, 화면을 누르면 체험 시작
// ---------------------------------------------------------------------------------------------
function AttractVideo({ onStart, onFail }: { onStart: () => void; onFail: () => void }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const v = ref.current
    if (!v) return
    // 소리 켜고 재생 — 브라우저가 소리 있는 자동 재생을 막으면 소리 없이라도 돈다
    v.currentTime = 0
    v.muted = false
    v.volume = 1
    v.play().catch(() => { v.muted = true; v.play().catch(() => {}) })
    // 소리가 막혀 있으면 키보드를 한 번 누르는 것으로 켠다(키 입력 = 사용자 동작, 대기 화면은 그대로)
    const unmute = () => { if (v.muted) { v.muted = false; v.play().catch(() => {}) } }
    window.addEventListener("keydown", unmute, true)
    return () => { window.removeEventListener("keydown", unmute, true); v.pause() }
  }, [])
  return (
    // pointerdown이 아니라 click으로 받아야 영상이 사라진 뒤 아래 버튼이 같이 눌리지 않는다
    <div className="kiosk-in fixed inset-0 z-[1200] cursor-none bg-black" onClick={onStart} aria-hidden>
      <video ref={ref} src={ATTRACT_VIDEO} className="size-full object-cover" playsInline loop preload="auto" onError={onFail} />
      <div className="kiosk-cta pointer-events-none absolute bottom-10 left-1/2 flex -translate-x-1/2 items-center gap-3 bg-primary px-6 py-4 text-primary-foreground shadow-xl">
        <MousePointerClick className="kiosk-tap size-6 shrink-0" aria-hidden />
        <div className="flex flex-col">
          <p className="text-base font-bold">화면을 클릭해서 직접 만들어 보세요</p>
          <p className="text-[12px] opacity-75">버튼만 눌러도 완성 · 결과는 QR로 휴대폰에</p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// 자동 시연 — 실제 대화를 녹화한 public/kiosk/scenarios.json 을 챗봇 화면 그대로 재생한다
// ---------------------------------------------------------------------------------------------
type BotData = {
  reply: string
  currentStep: string
  quickReplies: { label: string; value: string }[] | null
  recommendations: Recommendation[] | null
  situationSummary: string | null
  situationFilterApplied: boolean
  kakaoRouteLinks: { day: number; part: number; url: string }[] | null
  finalRoute: unknown[] | null
  facts: Record<string, unknown> | null
}
type Step = { kind: "user"; text: string } | { kind: "select"; ids: (string | number)[] } | { kind: "bot"; ms: number; data: BotData }
type Scenario = { id: string; shareId: string | null; title: string | null; steps: Step[] }

export const KIOSK_GREETING: ChatMessage = INITIAL_MESSAGE

export function botMessageFrom(data: BotData): ChatMessage {
  return {
    id: crypto.randomUUID(),
    sender: "bot",
    text: data.recommendations?.length
      ? `${data.situationSummary || "현재 여행 상황을 반영해 관광지를 추천했습니다."}\n\n추천 관광지를 클릭해서 선택해주세요. 여러 곳을 선택할 수 있습니다.`
      : data.reply,
    recommendations: data.recommendations,
    situationFilterApplied: data.situationFilterApplied,
    kakaoRouteLinks: data.kakaoRouteLinks,
    quickReplies: data.quickReplies,
    plan: Array.isArray(data.finalRoute) && data.finalRoute.length ? toChatPlan(data.finalRoute as never, data.facts ?? undefined) : null,
  }
}

export type KioskDemoView = {
  messages: ChatMessage[]
  typing: string
  thinking: boolean
  selectedIds: (string | number)[]
  step: string
  example: { shareId: string; title: string | null } | null
  // 동선이 완성되면 잠깐 보여 주는 카카오맵 길찾기
  mapUrl: string | null
}

const EMPTY: KioskDemoView = { messages: [KIOSK_GREETING], typing: "", thinking: false, selectedIds: [], step: "ASK_SERVICE_TYPE", example: null, mapUrl: null }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function useKioskDemo(active: boolean): KioskDemoView {
  const [view, setView] = useState<KioskDemoView>(EMPTY)
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const run = useRef(0)

  useEffect(() => {
    if (!active || scenarios.length) return
    fetch("/kiosk/scenarios.json").then((r) => r.json()).then((d) => setScenarios(d.scenarios || [])).catch(() => {})
  }, [active, scenarios.length])

  useEffect(() => {
    const my = ++run.current
    if (!active || !scenarios.length) return
    const alive = () => run.current === my
    ;(async () => {
      for (let n = 0; alive(); n++) {
        const sc = scenarios[n % scenarios.length]
        setView(EMPTY)
        await sleep(2000)
        for (const st of sc.steps) {
          if (!alive()) return
          if (st.kind === "user") {
            for (let i = 1; i <= st.text.length; i++) {
              if (!alive()) return
              setView((v) => ({ ...v, typing: st.text.slice(0, i) }))
              await sleep(st.text.startsWith("#") ? 25 : 110)
            }
            await sleep(500)
            setView((v) => ({ ...v, typing: "", selectedIds: [], messages: [...v.messages, { id: crypto.randomUUID(), sender: "user", text: st.text }] }))
          } else if (st.kind === "select") {
            for (const id of st.ids) {
              await sleep(800)
              if (!alive()) return
              setView((v) => ({ ...v, selectedIds: [...v.selectedIds, id] }))
            }
            await sleep(900)
          } else {
            setView((v) => ({ ...v, thinking: true }))
            await sleep(Math.min(Math.max(st.ms, 1000), 2800))
            if (!alive()) return
            setView((v) => ({ ...v, thinking: false, step: st.data.currentStep, messages: [...v.messages, botMessageFrom(st.data)] }))
            await sleep(st.data.recommendations?.length ? 1800 : st.data.finalRoute ? 5000 : 1500)
            // 동선이 완성되면 카카오맵 길찾기를 잠깐 띄워 실제 도로 경로를 보여 준다
            const route = st.data.kakaoRouteLinks?.[0]?.url
            if (st.data.finalRoute && route) {
              if (!alive()) return
              setView((v) => ({ ...v, mapUrl: route }))
              await sleep(11000)
              if (!alive()) return
              setView((v) => ({ ...v, mapUrl: null }))
              await sleep(800)
            }
          }
        }
        if (!alive()) return
        if (sc.shareId) {
          setView((v) => ({ ...v, example: { shareId: sc.shareId!, title: sc.title } }))
          await sleep(10000)
        }
      }
    })()
    return () => { run.current++ }
  }, [active, scenarios])

  return view
}

// ---------------------------------------------------------------------------------------------
// 자동 시연 중 왼쪽 설명 패널 — 시연이 진행되는 대로 단계가 체크되고, 지금 AI가 하는 일을 보여 준다(사이트 디자인 그대로)
// ---------------------------------------------------------------------------------------------
const JOURNEY = [
  { label: "지역 고르기", steps: ["ASK_SERVICE_TYPE", "ASK_REGION"], doing: "가고 싶은 지역을 고르면 시작해요" },
  { label: "여행 날짜", steps: ["ASK_PERIOD"], doing: "여행 날짜의 날씨를 미리 확인해요" },
  { label: "숙소 · 출발지", steps: ["ASK_ACCOMMODATION", "ASK_START_LOCATION"], doing: "숙소를 기준으로 실제 도로 거리를 계산해요" },
  { label: "누구와 함께", steps: ["ASK_COMPANION_TYPE"], doing: "함께 가는 사람에 맞춰 여행지 취향을 맞춰요" },
  { label: "여행지 추천", steps: ["RECOMMENDATION_SHOWN", "ASK_MORE_RECOMMENDATION", "ASK_ROUTE_RECOMMENDATION"], doing: "날씨·대기질·인기 순위를 반영해 여행지를 추천했어요" },
  { label: "동선 완성 + QR", steps: ["ROUTE_OPTIMIZED"], doing: "가장 효율적인 순서로 동선을 짜고, QR로 휴대폰에 보내요" },
]

function AttractPanel({ demo }: { demo: KioskDemoView }) {
  const index = Math.max(0, JOURNEY.findIndex((j) => j.steps.includes(demo.step)))
  const done = demo.step === "ROUTE_OPTIMIZED"
  const now = JOURNEY[index]
  return (
    <aside className="kiosk-attract-panel pointer-events-none fixed bottom-8 left-8 z-[46] flex w-[360px] flex-col gap-5 border border-border bg-background px-7 py-6 shadow-[0_24px_60px_-24px_oklch(0.22_0.004_60/0.35)]">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">AI Travel Concierge</span>
        <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.28em] text-accent">
          <span className="kiosk-live size-1.5 rounded-full bg-accent" aria-hidden />Live demo
        </span>
      </div>
      <p className="font-serif text-2xl leading-snug">
        경기북부 여행 동선,<br /><span className="text-accent">AI가 3분 만에</span> 짜 드려요.
      </p>
      <ol className="flex flex-col gap-2">
        {JOURNEY.map((j, i) => {
          const isDone = i < index || (done && i === index)
          const isNow = i === index && !done
          return (
            <li key={j.label} className={"flex items-center gap-3 text-sm transition-all duration-500 " +
              (isNow ? "translate-x-1 text-foreground" : isDone ? "text-foreground/70" : "text-muted-foreground/60")}>
              <span className={"flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] transition-colors duration-500 " +
                (isDone ? "border-accent bg-accent text-accent-foreground" : isNow ? "border-foreground" : "border-border")}>
                {isDone ? <Check className="size-3.5" aria-hidden /> : i + 1}
              </span>
              {j.label}
              {isNow && <span className="kiosk-live size-1.5 rounded-full bg-accent" aria-hidden />}
            </li>
          )
        })}
      </ol>
      <p key={demo.step + String(demo.thinking)} className="kiosk-doing flex items-start gap-2 border-l-2 border-accent pl-3 text-[13px] leading-relaxed text-muted-foreground">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
        {demo.thinking ? "AI가 생각하는 중이에요…" : now.doing}
      </p>
      <div className="kiosk-cta flex items-center gap-3 bg-primary px-4 py-3.5 text-primary-foreground">
        <MousePointerClick className="kiosk-tap size-6 shrink-0" aria-hidden />
        <div className="flex flex-col">
          <p className="text-sm font-bold">화면을 클릭해서 직접 만들어 보세요</p>
          <p className="text-[12px] opacity-75">버튼만 눌러도 완성 · 결과는 QR로 휴대폰에</p>
        </div>
      </div>
    </aside>
  )
}
