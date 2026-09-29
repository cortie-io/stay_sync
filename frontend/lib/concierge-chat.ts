"use client"

// AI 여행 컨시어지 대화 로직 — 기본 화면의 플로팅 챗봇과 AI 동선 플래너가 함께 쓴다(인터페이스만 다르다).
// 대화 흐름 자체는 백엔드 /api/chat 상태 머신이 결정한다.

import { useEffect, useMemo, useRef, useState } from "react"
import { itineraryFromRoute, type Itinerary } from "@/lib/planner"

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4500").replace(/\/$/, "")

const CHAT_STORAGE_KEY = "stay-sync.chat-session.v1"
const INITIAL_OPTIONS = [
  { label: "숙소 예약 완료", value: "2" },
  { label: "관광지 선택 완료 · 동선만", value: "3" },
]

export type QuickReply = { label: string; value: string }
export type KakaoRouteLink = { day: number; part: number; url: string }
export type Recommendation = {
  id: string | number
  name: string
  region?: string | null
  image?: string | null
  theme?: string | null
  category?: string | null
  address?: string | null
  description?: string | null
  mapx?: number | null
  mapy?: number | null
  roadDistanceKm?: number | null
  recommendationType?: string
  popularityPosition?: number | null
}
// 최종 여행 일정 답변 — 이야기(글)와 날짜별 동선(구조)을 따로 받아 카드로 정리해 보여준다.
export type ChatRouteStop = { name: string; fromPreviousKm?: number | null }
export type ChatRoute = {
  day: number
  date?: string | null
  origin?: { name: string } | null
  stops: ChatRouteStop[]
  returnToOrigin?: boolean
  returnDistanceKm?: number | null
  totalDistanceKm?: number | null
}
export type ChatPlan = {
  story: string | null
  routes: ChatRoute[]
  region?: string | null
  companion?: string | null
}

export type ChatMessage = {
  id: string
  sender: "bot" | "user"
  text: string
  isError?: boolean
  quickReplies?: QuickReply[] | null
  kakaoRouteLinks?: KakaoRouteLink[] | null
  recommendations?: Recommendation[] | null
  situationFilterApplied?: boolean
  // 동선 결과 — 플래너 화면은 지도와 함께 보여준다
  itinerary?: Itinerary | null
  plan?: ChatPlan | null
}
export type Suggestion = {
  id?: string | number
  kakaoPlaceId?: string
  name: string
  region?: string
  address?: string
}

type RawRoute = {
  day: number
  date?: string | null
  origin?: { name?: string } | null
  stops?: { name?: string; fromPreviousKm?: number | null }[]
  returnToOrigin?: boolean
  returnDistanceKm?: number | null
  totalDistanceKm?: number | null
}

function toChatPlan(routes: RawRoute[], facts: Record<string, unknown> | undefined): ChatPlan {
  return {
    story: typeof facts?.final_story === "string" ? facts.final_story : null,
    region: typeof facts?.region === "string" ? facts.region : null,
    companion: typeof facts?.companion_type === "string" ? facts.companion_type : null,
    routes: routes.map((route) => ({
      day: route.day,
      date: route.date ?? null,
      origin: route.origin?.name ? { name: route.origin.name } : null,
      stops: (route.stops || []).map((stop) => ({ name: String(stop.name || ""), fromPreviousKm: stop.fromPreviousKm ?? null })),
      returnToOrigin: Boolean(route.returnToOrigin),
      returnDistanceKm: route.returnDistanceKm ?? null,
      totalDistanceKm: route.totalDistanceKm ?? null,
    })),
  }
}

export const INITIAL_MESSAGE: ChatMessage = {
  id: "greeting",
  sender: "bot",
  text: "안녕하세요! 경기북부에서 가고 싶은 여행 지역이나 관광지명을 입력해주세요.\n예: 가평, 자라섬, 가족과 파주 여행\n지원 지역: 고양, 파주, 의정부, 양주, 동두천, 포천, 남양주, 구리, 가평, 연천\n\n숙소 또는 관광지를 이미 정한 경우에만 아래 항목을 선택해주세요.",
  quickReplies: INITIAL_OPTIONS,
}

type ChatSnapshot = {
  sessionId: string
  messages: ChatMessage[]
  input: string
  currentStep: string
  currentFacts: Record<string, unknown>
  selectedAttractions: Suggestion[]
  selectedRecommendations: Recommendation[]
  selectedLocation: Suggestion | null
}

// 페이지를 이동하거나 새로고침해도(두 인터페이스 사이를 오가도) 같은 탭에서는 대화를 이어가도록 sessionStorage에 보관한다.
function loadSavedChat(): ChatSnapshot | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.sessionStorage.getItem(CHAT_STORAGE_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw)
    if (!saved?.sessionId || !Array.isArray(saved.messages) || !saved.currentStep) return null
    return saved
  } catch {
    return null
  }
}

function saveChat(snapshot: ChatSnapshot) {
  try {
    window.sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(snapshot))
  } catch {}
}

export function inputPlaceholder(currentStep: string, region: unknown) {
  if (currentStep === "ASK_ROUTE_ATTRACTIONS") return "/관광지명을 입력하세요"
  if (currentStep === "ASK_START_LOCATION") return "출발지를 입력하세요"
  if (currentStep === "ASK_ACCOMMODATION") return `${region || ""} 숙소를 입력하세요`.trim()
  if (currentStep === "ASK_SERVICE_TYPE") return "경기북부 여행지 입력 (예: 가평, 자라섬)"
  return "메시지를 입력하세요"
}

export function useConciergeChat() {
  // 저장된 대화는 화면이 뜬 뒤(마운트 후) 복원한다. 렌더 중에 읽으면 서버가 그린 화면(첫 인사만)과 어긋나 하이드레이션 오류가 난다.
  const [restored, setRestored] = useState(false)
  const restoredSessionIdRef = useRef<string | null>(null)
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID())
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [currentStep, setCurrentStep] = useState("ASK_SERVICE_TYPE")
  const [currentFacts, setCurrentFacts] = useState<Record<string, unknown>>({})
  const [selectedAttractions, setSelectedAttractions] = useState<Suggestion[]>([])
  const [selectedRecommendations, setSelectedRecommendations] = useState<Recommendation[]>([])
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [selectedLocation, setSelectedLocation] = useState<Suggestion | null>(null)
  const [detailAttraction, setDetailAttraction] = useState<Recommendation | null>(null)
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  const browserLocale = typeof navigator !== "undefined" ? navigator.language || "ko-KR" : "ko-KR"

  const chatSnapshot = useMemo<ChatSnapshot>(
    () => ({
      sessionId,
      messages,
      input,
      currentStep,
      currentFacts,
      selectedAttractions,
      selectedRecommendations,
      selectedLocation,
    }),
    [sessionId, messages, input, currentStep, currentFacts, selectedAttractions, selectedRecommendations, selectedLocation],
  )

  useEffect(() => {
    const saved = loadSavedChat()
    if (saved) {
      restoredSessionIdRef.current = saved.sessionId
      setSessionId(saved.sessionId)
      setMessages(saved.messages)
      setInput(saved.input || "")
      setCurrentStep(saved.currentStep)
      setCurrentFacts(saved.currentFacts || {})
      setSelectedAttractions(saved.selectedAttractions || [])
      setSelectedRecommendations(saved.selectedRecommendations || [])
      setSelectedLocation(saved.selectedLocation || null)
    }
    setRestored(true)
  }, [])

  useEffect(() => {
    // 복원이 끝나기 전에 저장하면 저장된 대화를 빈 대화로 덮어쓴다.
    if (restored) saveChat(chatSnapshot)
  }, [restored, chatSnapshot])

  useEffect(() => {
    // 복원한 대화는 이미 인사말이 번역돼 있다. 초기화로 새 세션이 되면 다시 받아 온다.
    if (!restored || browserLocale.toLowerCase().startsWith("ko") || sessionId === restoredSessionIdRef.current) return
    const controller = new AbortController()
    fetch(`${API_BASE_URL}/api/chat/greeting?locale=${encodeURIComponent(browserLocale)}`, {
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((body) => {
        if (!body.success) return
        setMessages((current) =>
          current.map((message) =>
            message.id === "greeting"
              ? { ...message, text: body.data.reply, quickReplies: body.data.quickReplies }
              : message,
          ),
        )
      })
      .catch(() => {})
    return () => controller.abort()
  }, [restored, browserLocale, sessionId])

  useEffect(() => {
    const isAttractionSearch = currentStep === "ASK_ROUTE_ATTRACTIONS"
    const isDepartureSearch = currentStep === "ASK_START_LOCATION"
    const isAccommodationSearch = currentStep === "ASK_ACCOMMODATION"
    const query = isAttractionSearch ? (input.startsWith("/") ? input.slice(1).trim() : "") : input.trim()
    if ((!isAttractionSearch && !isDepartureSearch && !isAccommodationSearch) || !query) {
      setSuggestions([])
      return undefined
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const endpoint = isAttractionSearch ? "attractions" : "locations"
        const locationParams = isAccommodationSearch
          ? `&type=accommodation&region=${encodeURIComponent(String(currentFacts.region || ""))}`
          : ""
        const response = await fetch(
          `${API_BASE_URL}/api/chat/${endpoint}/autocomplete?q=${encodeURIComponent(query)}${locationParams}`,
          { signal: controller.signal },
        )
        const body = await response.json()
        if (response.ok && body.success) setSuggestions(body.data)
      } catch (error) {
        if ((error as Error).name !== "AbortError") setSuggestions([])
      }
    }, 180)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [currentStep, currentFacts.region, input])

  async function submitMessage(rawMessage: string, displayText: string = rawMessage) {
    const routeSelection = currentStep === "ASK_ROUTE_ATTRACTIONS" && selectedAttractions.length > 0
    const recommendationSelection = currentStep === "RECOMMENDATION_SHOWN" && selectedRecommendations.length > 0
    const selectedItems = routeSelection ? selectedAttractions : recommendationSelection ? selectedRecommendations : null
    const message = selectedItems ? selectedItems.map(({ name }) => name).join(", ") : String(rawMessage).trim()
    const visibleMessage = selectedItems ? selectedItems.map(({ name }) => `#${name}`).join(" ") : displayText
    if (!message || isSending) return

    setMessages((current) => [...current, { id: crypto.randomUUID(), sender: "user", text: visibleMessage }])
    setInput("")
    setSuggestions([])
    setIsSending(true)

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Request-Id": crypto.randomUUID() },
        body: JSON.stringify({ sessionId, message, location: selectedLocation, locale: browserLocale }),
      })
      const body = await response.json()
      if (!response.ok || !body.success) throw new Error(body.message || "응답을 불러오지 못했습니다.")

      const result = body.data
      setCurrentStep(result.currentStep)
      setCurrentFacts(result.facts || {})
      if (currentStep === "ASK_ROUTE_ATTRACTIONS") setSelectedAttractions([])
      if (currentStep === "RECOMMENDATION_SHOWN") setSelectedRecommendations([])
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          sender: "bot",
          text: result.recommendations?.length
            ? `${result.situationSummary || "현재 여행 상황을 반영해 관광지를 추천했습니다."}\n\n추천 관광지를 클릭해서 선택해주세요. 여러 곳을 선택할 수 있습니다.`
            : result.reply,
          kakaoRouteLinks: result.kakaoRouteLinks || null,
          quickReplies: result.quickReplies || null,
          recommendations: result.recommendations || null,
          situationFilterApplied: result.situationFilterApplied || false,
          itinerary: result.finalRoute ? itineraryFromRoute(result.finalRoute) : null,
          plan: Array.isArray(result.finalRoute) && result.finalRoute.length ? toChatPlan(result.finalRoute, result.facts) : null,
        },
      ])
    } catch {
      const lastQuestion = [...messages].reverse().find((item) => item.sender === "bot" && !item.isError)?.text
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          sender: "bot",
          text: lastQuestion
            ? `죄송합니다. 방금 답변을 만들지 못했어요. 다시 여쭤볼게요.\n\n${lastQuestion}`
            : "죄송합니다. 방금 답변을 만들지 못했어요. 한 번만 다시 말씀해주시겠어요?",
        },
      ])
    } finally {
      setIsSending(false)
    }
  }

  // 새 세션 ID로 처음 상태로 되돌린다. 저장된 대화는 다음 저장 때 빈 대화로 덮어써진다.
  function resetChat() {
    if (isSending) return
    setSessionId(crypto.randomUUID())
    setMessages([INITIAL_MESSAGE])
    setInput("")
    setCurrentStep("ASK_SERVICE_TYPE")
    setCurrentFacts({})
    setSelectedAttractions([])
    setSelectedRecommendations([])
    setSuggestions([])
    setSelectedLocation(null)
    setDetailAttraction(null)
    inputRef.current?.focus()
  }

  function selectAttraction(attraction: Suggestion) {
    setSelectedAttractions((current) => (current.some(({ id }) => id === attraction.id) ? current : [...current, attraction]))
    setInput("/")
    setSuggestions([])
    setSelectedLocation(null)
    inputRef.current?.focus()
  }

  function removeAttraction(id?: string | number) {
    setSelectedAttractions((current) => current.filter((attraction) => attraction.id !== id))
  }

  function toggleRecommendation(recommendation: Recommendation) {
    setSelectedRecommendations((current) =>
      current.some(({ id }) => id === recommendation.id)
        ? current.filter(({ id }) => id !== recommendation.id)
        : [...current, recommendation],
    )
  }

  function selectSuggestion(suggestion: Suggestion) {
    if (currentStep === "ASK_ROUTE_ATTRACTIONS") {
      selectAttraction(suggestion)
      return
    }
    setInput(suggestion.name)
    setSelectedLocation(suggestion)
    setSuggestions([])
    inputRef.current?.focus()
  }

  // 대화 밖에서 만든 결과(플래너 일정 등)를 같은 대화 기록에 붙인다.
  function appendMessages(...added: Omit<ChatMessage, "id">[]) {
    setMessages((current) => [...current, ...added.map((message) => ({ ...message, id: crypto.randomUUID() }))])
  }

  return {
    sessionId,
    messages,
    input,
    setInput,
    isSending,
    setIsSending,
    currentStep,
    currentFacts,
    selectedAttractions,
    selectedRecommendations,
    suggestions,
    setSelectedLocation,
    detailAttraction,
    setDetailAttraction,
    inputRef,
    lastIndex: messages.length - 1,
    hasSelection: selectedAttractions.length > 0 || selectedRecommendations.length > 0,
    submitMessage,
    resetChat,
    removeAttraction,
    toggleRecommendation,
    selectSuggestion,
    appendMessages,
  }
}
