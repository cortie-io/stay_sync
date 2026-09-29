"use client"

import { ArrowRight, ArrowUp, Check, Maximize2, Minimize2, PanelRightClose, Plus, RotateCcw, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { askAssistant, type AssistAction, type Destination } from "@/lib/planner"
import { MessageText } from "@/components/message-text"
import { SafeImage } from "@/components/safe-image"

export type PanelMode = "open" | "collapsed" | "fullscreen"

export type AssistantMessage = {
  id: string
  role: "user" | "bot"
  text: string
  isError?: boolean
  recommendations?: Destination[]
  regions?: string[]
  // 일정이 만들어졌을 때 "일정 보기" 버튼
  showItinerary?: boolean
}

const STORAGE_KEY = "stay-sync.planner-assistant.v1"

const SUGGESTIONS = [
  "가평에서 아이랑 가기 좋은 곳 추천해줘",
  "비 오는 날 파주 실내 명소",
  "역사 좋아하는 부모님과 갈 만한 포천 여행지",
  "담은 곳으로 1박 2일 일정 짜줘",
]

type AssistantContext = { selectedIds: number[]; days: number; region?: string | null }

// 플래너 전용 AI 어시스턴트 — 담은 곳·기간·지역을 함께 보내 추천·기간 변경·일정 생성을 돕는다.
export function usePlannerAssistant({
  sessionId,
  getContext,
  onActions,
}: {
  sessionId: string
  getContext: () => AssistantContext
  onActions: (actions: AssistAction[]) => void
}) {
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [busy, setBusy] = useState(false)
  const [restored, setRestored] = useState(false)

  // 서버 렌더와 어긋나지 않게 마운트 후 복원한다.
  useEffect(() => {
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || "null")
      if (Array.isArray(saved?.messages)) setMessages(saved.messages)
    } catch {}
    setRestored(true)
  }, [])

  useEffect(() => {
    if (!restored) return
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ messages: messages.slice(-60) }))
    } catch {}
  }, [restored, messages])

  function append(...added: Omit<AssistantMessage, "id">[]) {
    setMessages((current) => [...current, ...added.map((m) => ({ ...m, id: crypto.randomUUID() }))])
  }

  async function send(text: string) {
    const message = text.trim()
    if (!message || busy) return
    append({ role: "user", text: message })
    setBusy(true)
    try {
      const result = await askAssistant({ sessionId, message, context: getContext() })
      const askRegion = result.actions.find((a) => a.type === "askRegion")
      append({
        role: "bot",
        text: result.reply,
        recommendations: result.recommendations.length ? result.recommendations : undefined,
        regions: askRegion && askRegion.type === "askRegion" ? askRegion.regions : undefined,
      })
      onActions(result.actions)
    } catch (error) {
      append({ role: "bot", isError: true, text: (error as Error).message || "답변을 만들지 못했어요. 잠시 후 다시 시도해주세요." })
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    if (!busy) setMessages([])
  }

  return { messages, busy, send, append, reset }
}

type Assistant = ReturnType<typeof usePlannerAssistant>

function RecommendationCard({
  item,
  added,
  onToggle,
  onOpen,
}: {
  item: Destination
  added: boolean
  onToggle: () => void
  onOpen: () => void
}) {
  return (
    <li className="flex items-center gap-3 border-b border-border py-3">
      <button type="button" onClick={onOpen} className="group flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="relative size-12 shrink-0 overflow-hidden rounded-sm bg-muted">
          <SafeImage src={item.image || "/placeholder.svg"} fallback="/placeholder.svg" alt="" fill sizes="48px" className="object-cover" />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-serif text-sm group-hover:text-accent">{item.name}</span>
          <span className="truncate text-[11px] text-muted-foreground">{[item.region, item.tag, item.indoorOutdoor].filter(Boolean).join(" · ")}</span>
          {item.description && <span className="line-clamp-1 text-[11px] text-muted-foreground">{item.description}</span>}
        </span>
      </button>
      <button
        type="button"
        onClick={onToggle}
        aria-label={added ? `${item.name} 빼기` : `${item.name} 담기`}
        className={cn(
          "inline-flex h-7 shrink-0 items-center gap-1 rounded-full border px-2.5 text-[11px] transition-colors",
          added ? "border-accent bg-accent text-accent-foreground" : "border-input hover:border-foreground",
        )}
      >
        {added ? <Check className="size-3" aria-hidden /> : <Plus className="size-3" aria-hidden />}
        {added ? "담김" : "담기"}
      </button>
    </li>
  )
}

export function AssistantPanel({
  assistant,
  busyLabel,
  mode,
  onModeChange,
  selectedIds,
  onToggle,
  onOpen,
  onAddAll,
  onShowItinerary,
  onReset,
  canReset,
}: {
  assistant: Assistant
  busyLabel: string | null
  mode: PanelMode
  onModeChange: (mode: PanelMode) => void
  selectedIds: number[]
  onToggle: (d: Destination) => void
  onOpen: (d: Destination) => void
  onAddAll: (items: Destination[]) => void
  onShowItinerary: () => void
  // 대화뿐 아니라 담은 곳·일정까지 새로 시작한다(플래너가 처리)
  onReset: () => void
  canReset: boolean
}) {
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const large = mode === "fullscreen"
  const working = assistant.busy || Boolean(busyLabel)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [assistant.messages, working])

  function submit(text = input) {
    if (!text.trim() || working) return
    assistant.send(text)
    setInput("")
  }

  const toolButton = "flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"

  return (
    <section aria-label="AI 여행 컨시어지" className="flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-serif text-base text-foreground">AI 여행 컨시어지</h2>
          <p className="flex items-center gap-1.5 text-[11px] tracking-wide text-muted-foreground">
            <span className={cn("size-1.5 rounded-full bg-accent", working && "animate-pulse")} aria-hidden />
            {working ? busyLabel || "답변을 준비하고 있습니다" : "담은 곳과 기간을 알고 있어요"}
          </p>
        </div>
        <div className="flex items-center">
          <button type="button" onClick={onReset} disabled={!canReset || working} title="새로 계획하기" className={toolButton}>
            <RotateCcw className="size-4" strokeWidth={1.25} aria-hidden />
            <span className="sr-only">대화와 일정 초기화</span>
          </button>
          <button type="button" onClick={() => onModeChange(large ? "open" : "fullscreen")} className={cn(toolButton, "hidden lg:flex")}>
            {large ? <Minimize2 className="size-4" strokeWidth={1.25} aria-hidden /> : <Maximize2 className="size-4" strokeWidth={1.25} aria-hidden />}
            <span className="sr-only">{large ? "기본 화면으로" : "크게 보기"}</span>
          </button>
          <button type="button" onClick={() => onModeChange(large ? "open" : "collapsed")} className={toolButton}>
            {large ? <X className="size-4" strokeWidth={1.25} aria-hidden /> : <PanelRightClose className="size-4" strokeWidth={1.25} aria-hidden />}
            <span className="sr-only">{large ? "닫기" : "접기"}</span>
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-6" aria-live="polite">
        <div className={cn("mx-auto flex flex-col gap-6", large && "max-w-3xl")}>
          {assistant.messages.length === 0 && (
            <div className="flex flex-col gap-8 pt-2">
              <div className="flex flex-col gap-3">
                <span className="text-[10px] uppercase tracking-[0.28em] text-accent">Concierge</span>
                <p className="text-balance font-serif text-2xl leading-snug text-foreground">어디로 떠나볼까요?</p>
                <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                  누구와, 어떤 여행을 원하는지 말씀해 주세요. 경기북부 인기 여행지를 골라 드리고, 담은 곳으로 날짜별 동선까지 짜 드려요.
                </p>
              </div>
              <ul className="flex flex-col border-t border-border">
                {SUGGESTIONS.map((s) => (
                  <li key={s} className="border-b border-border">
                    <button type="button" onClick={() => submit(s)} className="group flex w-full items-center justify-between gap-3 py-3.5 text-left text-sm">
                      {s}
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground" strokeWidth={1.25} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {assistant.messages.map((m, index) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap rounded-sm bg-muted px-4 py-3 text-sm leading-relaxed">{m.text}</p>
              </div>
            ) : (
              <div key={m.id} className="flex flex-col gap-2">
                <span className="text-[10px] uppercase tracking-[0.28em] text-accent">Concierge</span>
                <div className={cn("text-sm", m.isError && "text-destructive")}>
                  <MessageText text={m.text} />
                </div>
                {m.regions && index === assistant.messages.length - 1 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {m.regions.map((region) => (
                      <button
                        key={region}
                        type="button"
                        disabled={working}
                        onClick={() => submit(`${region} 여행지 추천해줘`)}
                        className="rounded-full border border-input px-3 py-1 text-xs hover:border-foreground disabled:opacity-40"
                      >
                        {region}
                      </button>
                    ))}
                  </div>
                )}
                {m.recommendations && (
                  <>
                    <ul className="mt-1 flex flex-col border-t border-border">
                      {m.recommendations.map((item) => (
                        <RecommendationCard
                          key={item.id}
                          item={item}
                          added={selectedIds.includes(item.id)}
                          onToggle={() => onToggle(item)}
                          onOpen={() => onOpen(item)}
                        />
                      ))}
                    </ul>
                    {m.recommendations.some((item) => !selectedIds.includes(item.id)) && (
                      <button
                        type="button"
                        onClick={() => onAddAll(m.recommendations!)}
                        className="self-start text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                      >
                        추천한 곳 모두 담기
                      </button>
                    )}
                  </>
                )}
                {m.showItinerary && (
                  <button
                    type="button"
                    onClick={onShowItinerary}
                    className="mt-1 inline-flex h-9 items-center gap-2 self-start rounded-sm bg-primary px-4 text-[13px] text-primary-foreground hover:opacity-85"
                  >
                    일정 보기
                    <ArrowRight className="size-4" aria-hidden />
                  </button>
                )}
              </div>
            ),
          )}

          {working && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="size-1 animate-pulse rounded-full bg-accent" aria-hidden />
              {busyLabel || "답변을 준비하고 있습니다"}
            </p>
          )}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="px-6 pb-6"
      >
        <div className={cn("mx-auto flex items-end gap-2 border-b border-input pb-2 transition-colors focus-within:border-foreground", large && "max-w-3xl")}>
          <label htmlFor="planner-assistant-input" className="sr-only">
            메시지 입력
          </label>
          <textarea
            id="planner-assistant-input"
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                if (e.nativeEvent.isComposing || e.keyCode === 229) return
                e.preventDefault()
                submit()
              }
            }}
            placeholder="예: 연인과 가평 1박 2일, 자연 위주로"
            className="max-h-32 min-h-8 flex-1 resize-none bg-transparent py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={!input.trim() || working}
            className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-20"
          >
            <ArrowUp className="size-4" strokeWidth={1.5} aria-hidden />
            <span className="sr-only">보내기</span>
          </button>
        </div>
      </form>
    </section>
  )
}
