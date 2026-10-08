"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowRight, ArrowUp, CalendarDays, MessageCircle, RotateCcw, X } from "lucide-react"
import { Eyebrow } from "@/components/section-heading"
import { MessageText } from "@/components/message-text"
import { BotMessage } from "@/components/bot-message"
import { ItineraryReply } from "@/components/itinerary-reply"
import { periodChoices, pickedDateMessage, REGION_STEPS, stepChoices, useConciergeChat } from "@/lib/concierge-chat"
import { kioskShareOrigin, useKiosk } from "@/lib/kiosk"
import { ShareDialog } from "@/components/planner/share-card"
import { TripResultDialog } from "@/components/trip-result-dialog"
import type { Itinerary } from "@/lib/planner"

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4500").replace(/\/$/, "")

export function FloatingChatbot() {
  const [open, setOpen] = useState(false)
  const {
    sessionId,
    messages,
    input,
    setInput,
    isSending,
    currentStep,
    currentFacts,
    selectedAttractions,
    selectedRecommendations,
    suggestions,
    suggestionsPreset,
    presetTitle,
    setSelectedLocation,
    detailAttraction,
    setDetailAttraction,
    inputRef,
    lastIndex,
    hasSelection,
    submitMessage,
    resetChat,
    removeAttraction,
    toggleRecommendation,
    selectSuggestion,
  } = useConciergeChat()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const datePickerRef = useRef<HTMLInputElement>(null)

  // ---------- 전시(키오스크) 모드 ----------
  const kiosk = useKiosk()
  const attract = kiosk.enabled && kiosk.mode === "attract"
  const live = kiosk.enabled && kiosk.mode === "live"
  const demo = kiosk.demo
  const isOpen = open || attract
  const viewMessages = attract ? demo.messages : messages
  const viewSending = attract ? demo.thinking : isSending
  const viewInput = attract ? demo.typing : input
  const viewSelectedIds = attract ? demo.selectedIds : selectedRecommendations.map(({ id }) => id)
  const viewLastIndex = viewMessages.length - 1
  const [result, setResult] = useState<{ url: string; itinerary: Itinerary } | null>(null)
  const [resultLoading, setResultLoading] = useState(false)
  const [resultHold, setResultHold] = useState(false)
  const savedFor = useRef<string | null>(null)

  // 체험을 시작하거나 처음으로 돌아가면 대화를 새로 시작한다(앞사람 내용이 남지 않게)
  useEffect(() => {
    if (!kiosk.enabled) return
    setOpen(kiosk.mode === "live") // 체험 시작 때는 열어 두고, 이후엔 원래처럼 닫기/열기 가능
    resetChat(false) // 터치스크린에서 화상 키보드가 튀어나오지 않게 포커스는 주지 않는다
    setResult(null)
    setDetailAttraction(null)
    savedFor.current = null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kiosk.enabled, kiosk.mode === "live", kiosk.resetToken])

  // 답을 기다리는 동안·결과 QR을 보는 동안은 자동 초기화를 미룬다
  useEffect(() => {
    kiosk.setBusy(isSending || resultHold)
  }, [kiosk, isSending, resultHold])
  useEffect(() => {
    if (!result) return
    setResultHold(true)
    const t = setTimeout(() => setResultHold(false), 90_000)
    return () => clearTimeout(t)
  }, [result])

  // 대화로 완성한 일정을 공유 일정으로 저장하고 QR을 띄운다(같은 대화는 한 번만 저장되고 다시 누르면 같은 QR)
  async function showQr() {
    if (resultLoading) return
    setResultLoading(true)
    try {
      const saved = await fetch(`${API_BASE_URL}/api/planner/trips/from-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      }).then((r) => r.json())
      if (!saved.success) return
      const trip = await fetch(`${API_BASE_URL}/api/planner/trips/${encodeURIComponent(saved.data.shareId)}`).then((r) => r.json())
      if (!trip.success) return
      setResult({
        url: `${kioskShareOrigin()}/planner/trip/${saved.data.shareId}${kiosk.enabled ? "?from=kiosk" : ""}`,
        itinerary: trip.data.itinerary,
      })
    } catch {
      // 결과 창을 못 띄워도 대화 안의 일정 카드는 그대로 볼 수 있다
    } finally {
      setResultLoading(false)
    }
  }

  // 일정이 막 완성되면(답을 기다리다 끝났을 때) 결과 창을 크게 띄운다. 새로고침으로 복원한 대화에서는 다시 띄우지 않는다.
  const wasSending = useRef(false)
  useEffect(() => {
    const justFinished = wasSending.current && !isSending
    wasSending.current = isSending
    if (!justFinished || attract || savedFor.current === sessionId) return
    if (!messages[messages.length - 1]?.plan) return
    savedFor.current = sessionId
    showQr()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSending])

  // 새 답이 오면 아래로 — 단, 추천 관광지 목록이 오면 목록 맨 위(안내 문구)부터 보이게 그 답의 시작으로 맞춘다
  const logRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!isOpen) return
    const last = viewMessages[viewMessages.length - 1]
    if (!viewSending && last?.sender === "bot" && last.recommendations?.length) {
      const el = logRef.current?.querySelector<HTMLElement>(`[data-msg="${last.id}"]`)
      if (el && logRef.current) {
        logRef.current.scrollTo({ top: el.offsetTop - 16, behavior: "smooth" }) // 목록이 relative라 offsetTop은 목록 기준
        return
      }
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMessages.length, viewSending, isOpen, suggestionsPreset])

  // 자동 시연에서 카드가 골라질 때만 그 카드가 보이게 살짝 움직인다(직접 고를 때는 화면을 움직이지 않는다)
  useEffect(() => {
    if (!attract || !viewSelectedIds.length) return
    const id = viewSelectedIds[viewSelectedIds.length - 1]
    logRef.current?.querySelector<HTMLElement>(`[data-rec="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [attract, viewSelectedIds])

  function sendMessage(event: React.FormEvent) {
    event.preventDefault()
    submitMessage(input)
  }

  return (
    <div
      className={"fixed right-5 bottom-5 z-50 flex flex-col items-end gap-3 md:right-8 md:bottom-8" + (attract ? " kiosk-attract" : "")}
      onPointerDownCapture={attract ? (e) => { e.preventDefault(); kiosk.startLive() } : undefined}
    >
      {isOpen && (
        <div
          role="dialog"
          aria-label="AI 여행 컨시어지"
          className="flex h-[min(620px,calc(100dvh-8rem))] w-[min(400px,calc(100vw-2.5rem))] flex-col border border-border bg-background shadow-[0_24px_60px_-24px_oklch(0.22_0.004_60/0.3)]"
        >
          <div className="flex items-start justify-between border-b border-border px-6 py-5">
            <div className="flex flex-col gap-1">
              <p className="font-serif text-lg">AI 여행 컨시어지</p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span aria-hidden className="size-1.5 rounded-full bg-accent" />
                동행자 맞춤 여행 추천
              </p>
            </div>
            <div className="flex items-center gap-4">
              {attract ? (
                // 자동 시연 중에는 "대화하러 가기" — 누르면 바로 직접 대화를 시작한다
                <button
                  type="button"
                  onClick={kiosk.startLive}
                  className="flex items-center gap-1.5 text-xs text-accent transition-colors hover:text-foreground"
                >
                  <MessageCircle className="size-3.5" aria-hidden />
                  대화하러 가기
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => resetChat()}
                  disabled={isSending || messages.length <= 1}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                >
                  <RotateCcw className="size-3.5" aria-hidden />
                  대화 초기화
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="닫기"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
          </div>

          <div ref={logRef} className="relative flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-6" aria-live="polite">
            <div className="flex flex-col gap-2">
              <Eyebrow>Concierge</Eyebrow>
              <p className="font-serif text-2xl">어디로 떠나볼까요?</p>
            </div>

            {viewMessages.map((message, messageIndex) => {
              const isLatest = messageIndex === viewLastIndex
              if (message.sender === "user") {
                return (
                  <div key={message.id} className="flex justify-end">
                    <div className="max-w-[85%] bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                      <MessageText text={message.text} />
                    </div>
                  </div>
                )
              }

              // 최종 여행 일정은 긴 글 대신 정리된 카드로 보여준다.
              if (message.plan) {
                return (
                  <div key={message.id} data-msg={message.id} className="flex flex-col gap-3 text-sm">
                    <p className="text-foreground">선택한 관광지로 여행 일정을 정리했어요.</p>
                    <ItineraryReply plan={message.plan} links={message.kakaoRouteLinks} onShowQr={attract ? undefined : showQr} />
                    {isLatest && !attract && !isSending && (
                      <button
                        type="button"
                        onClick={() => resetChat(false)}
                        className="flex w-full items-center justify-between gap-3 border-y border-border py-3.5 text-left transition-colors hover:text-accent"
                      >
                        새 여행 계획하기
                        <ArrowRight className="size-4 shrink-0" aria-hidden />
                      </button>
                    )}
                  </div>
                )
              }

              // 지금 답할 차례인 메시지에는 단계에 맞는 답을 버튼으로 붙인다(백엔드가 버튼을 준 경우는 그것을 쓴다)
              const canAnswer = isLatest && !attract && !isSending
              const regionChipsInText = message.text.includes("지원 지역:")
              const choices = canAnswer && !message.quickReplies?.length && !message.recommendations?.length
                ? stepChoices(currentStep, currentFacts)
                : null
              const showChoices = choices && !(regionChipsInText && REGION_STEPS.includes(currentStep))

              return (
                <div key={message.id} data-msg={message.id} className="flex flex-col gap-3 text-sm">
                  <div className={message.isError ? "text-destructive" : "text-foreground"}>
                    <BotMessage
                      text={message.text}
                      onChip={canAnswer && REGION_STEPS.includes(currentStep) ? (region) => submitMessage(region) : undefined}
                    />
                  </div>

                  {showChoices && choices.style === "list" && (
                    <ul className="border-t border-border">
                      {choices.options.map((option) => (
                        <li key={option.value} className="border-b border-border">
                          <button
                            type="button"
                            onClick={() => submitMessage(option.value, option.label)}
                            className="flex w-full items-center justify-between gap-3 py-3.5 text-left transition-colors hover:text-accent"
                          >
                            {option.label}
                            <ArrowRight className="size-4 shrink-0" aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {showChoices && choices.style === "chips" && (
                    <div className="flex flex-wrap gap-1.5">
                      {choices.options.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => submitMessage(option.value, option.label)}
                          className="border border-border bg-background px-3 py-1.5 text-[13px] text-foreground transition-colors hover:border-accent hover:text-accent"
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {message.quickReplies && (
                    <ul className="border-t border-border">
                      {message.quickReplies.some(({ value }) => value === "2") && (
                        <li className="pt-3 text-xs text-muted-foreground">이미 준비한 여행 정보가 있다면</li>
                      )}
                      {message.quickReplies.map((option) => (
                        <li key={option.value} className="border-b border-border">
                          <button
                            type="button"
                            disabled={isSending || !isLatest}
                            onClick={() => submitMessage(option.value, option.label)}
                            className="flex w-full items-center justify-between gap-3 py-3.5 text-left transition-colors hover:text-accent disabled:pointer-events-none disabled:text-muted-foreground"
                          >
                            {option.label}
                            <ArrowRight className="size-4 shrink-0" aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {message.kakaoRouteLinks && (
                    <div className="flex flex-wrap gap-2">
                      {message.kakaoRouteLinks.map((link) => (
                        <a
                          key={`${link.day}-${link.part}`}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 border border-accent px-3 py-2 text-xs text-accent transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                          {link.day}일 차 카카오맵 열기{link.part > 1 ? ` (${link.part})` : ""}
                          <ArrowRight className="size-3.5" aria-hidden />
                        </a>
                      ))}
                    </div>
                  )}

                  {message.recommendations && (
                    <ul className="border-t border-border">
                      {message.recommendations.map((recommendation, recommendationIndex) => {
                        const selected = viewSelectedIds.includes(recommendation.id)
                        const isDistance = recommendation.recommendationType === "distance"
                        const typeRank = message.recommendations!
                          .slice(0, recommendationIndex + 1)
                          .filter((item) => (item.recommendationType === "distance") === isDistance).length
                        const rank = recommendation.popularityPosition || typeRank
                        return (
                          <li key={recommendation.id} className="border-b border-border">
                            <div
                              data-rec={recommendation.id}
                              role="button"
                              tabIndex={isLatest ? 0 : -1}
                              aria-pressed={selected}
                              onClick={() => {
                                if (!isSending && isLatest) toggleRecommendation(recommendation)
                              }}
                              onKeyDown={(event) => {
                                if ((event.key === "Enter" || event.key === " ") && !isSending && isLatest) {
                                  event.preventDefault()
                                  toggleRecommendation(recommendation)
                                }
                              }}
                              className={
                                "group flex cursor-pointer items-center gap-3 py-3 transition-colors " +
                                (selected ? "text-accent" : "hover:text-accent")
                              }
                            >
                              <div className="relative size-14 shrink-0 overflow-hidden bg-muted">
                                {recommendation.image && (
                                  <img
                                    src={recommendation.image}
                                    alt={`${recommendation.name} 대표 사진`}
                                    loading="lazy"
                                    className="size-full object-cover"
                                  />
                                )}
                                {selected && (
                                  <span className="absolute inset-0 grid place-items-center bg-accent/80 font-serif text-xs text-accent-foreground">
                                    선택
                                  </span>
                                )}
                              </div>
                              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className="truncate font-serif text-base">{recommendation.name}</span>
                                <span className="truncate text-xs text-muted-foreground">
                                  {isDistance ? "거리순" : "인기순"} {rank}위
                                  {recommendation.roadDistanceKm != null && ` · 숙소에서 ${recommendation.roadDistanceKm}km`}
                                </span>
                                <span className="truncate text-xs text-muted-foreground">
                                  {[recommendation.theme, recommendation.address].filter(Boolean).join(" · ")}
                                </span>
                                {message.situationFilterApplied && (
                                  <span className="text-xs text-muted-foreground">날씨·대기질 맞춤 실내 추천</span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setDetailAttraction(recommendation)
                                }}
                                className="shrink-0 border-b border-foreground pb-0.5 text-xs text-foreground transition-colors hover:border-accent hover:text-accent"
                              >
                                상세
                              </button>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )
            })}

            {viewSending && (
              <div className="flex items-center gap-1 py-1" aria-label="답변 작성 중">
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} className="relative border-t border-border px-6 py-4">
            {suggestions.length > 0 && (
              <ul className={suggestionsPreset
                ? "mb-3 max-h-44 overflow-y-auto border border-border bg-background px-4"
                : "absolute inset-x-0 bottom-full z-10 max-h-72 overflow-y-auto border-t border-border bg-background px-6"}>
                {suggestionsPreset && (
                  <li className="flex items-baseline justify-between gap-2 pt-3 pb-1">
                    <span className="text-[12px] uppercase tracking-[0.04em] text-muted-foreground">{presetTitle}</span>
                    <span className="text-[12px] text-muted-foreground">
                      {currentStep === "ASK_ROUTE_ATTRACTIONS" ? "눌러서 담고, /이름으로 검색도 돼요" : "골라도 되고, 직접 입력해도 돼요"}
                    </span>
                  </li>
                )}
                {suggestions.map((attraction) => (
                  <li key={attraction.id ?? attraction.kakaoPlaceId} className="border-b border-border last:border-b-0">
                    <button
                      type="button"
                      onClick={() => selectSuggestion(attraction)}
                      className={"flex w-full flex-col gap-0.5 text-left text-sm transition-colors hover:text-accent " + (suggestionsPreset ? "py-2" : "py-3")}
                    >
                      <span className="font-serif">{attraction.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {[attraction.region, attraction.address].filter(Boolean).join(" · ")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}


            {(attract ? demo.step : currentStep) === "ASK_SERVICE_TYPE" && (
              <div className="mb-3 flex items-start gap-3 border-l-2 border-accent bg-accent/10 px-3.5 py-2.5">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-bold text-accent-foreground">1</span>
                <p className="flex flex-col gap-0.5 text-xs leading-relaxed text-muted-foreground">
                  <span className="text-[13px] font-bold text-accent">경기북부 여행지를 먼저 골라주세요</span>
                  위 지원 지역을 누르거나, 관광지명을 직접 적어주세요.
                </p>
              </div>
            )}

            {(attract ? demo.step : currentStep) === "ASK_PERIOD" && (
              <div className="mb-3 flex flex-col gap-2 border-l-2 border-accent bg-accent/10 px-3.5 py-2.5 text-xs text-muted-foreground">
                <span className="text-[13px] font-bold text-accent">여행 날짜를 골라주세요</span>
                <span className="flex flex-wrap gap-1.5">
                  {periodChoices(currentFacts).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      disabled={attract || isSending}
                      onClick={() => submitMessage(option.value, option.label)}
                      className="border border-border bg-background px-2.5 py-1 text-[12.5px] text-foreground transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
                    >
                      {option.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={attract || isSending}
                    onClick={() => {
                      const picker = datePickerRef.current
                      if (!picker) return
                      try {
                        picker.showPicker()
                      } catch {
                        picker.focus()
                        picker.click()
                      }
                    }}
                    className="inline-flex items-center gap-1 border border-border bg-background px-2.5 py-1 text-[12.5px] text-foreground transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
                  >
                    <CalendarDays className="size-3.5" aria-hidden />
                    달력에서 고르기
                  </button>
                  <input
                    ref={datePickerRef}
                    type="date"
                    tabIndex={-1}
                    aria-hidden
                    min={new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10)}
                    onChange={(event) => {
                      const [y, m, d] = event.target.value.split("-").map(Number)
                      event.target.value = ""
                      if (!y || !m || !d) return
                      const message = pickedDateMessage(currentFacts, new Date(y, m - 1, d))
                      submitMessage(message)
                    }}
                    className="pointer-events-none absolute size-px opacity-0"
                  />
                </span>
                <span>직접 입력해도 돼요. 예: 10월 10일 ~ 10월 12일</span>
              </div>
            )}

            {hasSelection && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {currentStep === "ASK_ROUTE_ATTRACTIONS" &&
                  selectedAttractions.map((attraction) => (
                    <span
                      key={attraction.id}
                      className="inline-flex items-center gap-1 border border-accent py-0.5 pr-1 pl-2.5 text-xs text-accent"
                    >
                      {attraction.name}
                      <button
                        type="button"
                        onClick={() => removeAttraction(attraction.id)}
                        aria-label={`${attraction.name} 삭제`}
                        className="grid size-4 place-items-center"
                      >
                        <X className="size-3" aria-hidden />
                      </button>
                    </span>
                  ))}
                {currentStep === "RECOMMENDATION_SHOWN" &&
                  selectedRecommendations.map((recommendation) => (
                    <span
                      key={recommendation.id}
                      className="inline-flex items-center gap-1 border border-accent py-0.5 pr-1 pl-2.5 text-xs text-accent"
                    >
                      #{recommendation.name}
                      <button
                        type="button"
                        onClick={() => toggleRecommendation(recommendation)}
                        aria-label={`${recommendation.name} 삭제`}
                        className="grid size-4 place-items-center"
                      >
                        <X className="size-3" aria-hidden />
                      </button>
                    </span>
                  ))}
              </div>
            )}

            {!attract && !isSending && currentStep === "RECOMMENDATION_SHOWN" && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {selectedRecommendations.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => submitMessage("")}
                    className="inline-flex items-center gap-1.5 bg-primary px-3 py-1.5 text-[13px] text-primary-foreground transition-colors hover:bg-primary/85"
                  >
                    선택한 {selectedRecommendations.length}곳 담기
                    <ArrowRight className="size-3.5" aria-hidden />
                  </button>
                ) : Array.isArray(currentFacts.selected_places) && currentFacts.selected_places.length > 0 ? (
                  // 앞에서 이미 고른 곳이 있으면 더 고르지 않고 바로 동선을 만들 수 있다
                  <button
                    type="button"
                    onClick={() => submitMessage("이대로 동선 만들기")}
                    className="inline-flex items-center gap-1.5 bg-primary px-3 py-1.5 text-[13px] text-primary-foreground transition-colors hover:bg-primary/85"
                  >
                    고른 {currentFacts.selected_places.length}곳으로 동선 만들기
                    <ArrowRight className="size-3.5" aria-hidden />
                  </button>
                ) : (
                  <span className="self-center text-xs text-muted-foreground">위 목록에서 가고 싶은 곳을 눌러 선택하세요</span>
                )}
                {/* 이 지역에서 더 추천할 곳이 없으면 "더 보기"는 감춘다 */}
                {selectedRecommendations.length === 0 && currentFacts.recommendation_has_more !== false && (
                  <button
                    type="button"
                    onClick={() => submitMessage("다른 곳 추천해줘", "다른 관광지 더 보기")}
                    className="border border-border bg-background px-3 py-1.5 text-[13px] text-foreground transition-colors hover:border-accent hover:text-accent"
                  >
                    다른 관광지 더 보기
                  </button>
                )}
              </div>
            )}

            {!attract && !isSending && currentStep === "ASK_ROUTE_ATTRACTIONS" && selectedAttractions.length > 0 && (
              <div className="mb-3">
                <button
                  type="button"
                  onClick={() => submitMessage("")}
                  className="inline-flex items-center gap-1.5 bg-primary px-3 py-1.5 text-[13px] text-primary-foreground transition-colors hover:bg-primary/85"
                >
                  {selectedAttractions.length}곳으로 동선 만들기
                  <ArrowRight className="size-3.5" aria-hidden />
                </button>
              </div>
            )}

            <div className="flex items-center gap-3">
              <label htmlFor="chat-message" className="sr-only">
                메시지
              </label>
              <input
                id="chat-message"
                ref={inputRef}
                value={viewInput}
                readOnly={attract}
                onChange={(event) => {
                  setInput(event.target.value)
                  setSelectedLocation(null)
                }}
                placeholder={
                  currentStep === "ASK_ROUTE_ATTRACTIONS"
                    ? "/관광지명을 입력하세요"
                    : currentStep === "ASK_START_LOCATION"
                      ? "출발지를 입력하세요"
                      : currentStep === "ASK_ACCOMMODATION"
                        ? `${currentFacts.region || ""} 숙소를 입력하세요`.trim()
                        : currentStep === "ASK_SERVICE_TYPE"
                          ? "경기북부 여행지 입력 (예: 가평, 자라섬)"
                          : currentStep === "ASK_PERIOD"
                            ? "여행 날짜 입력 (예: 내일부터 1박 2일)"
                            : "메시지를 입력하세요"
                }
                autoComplete="off"
                disabled={isSending}
                className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-60"
              />
              <button
                type="submit"
                aria-label="보내기"
                disabled={(!input.trim() && !hasSelection) || isSending}
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/85 disabled:bg-muted disabled:text-muted-foreground"
              >
                <ArrowUp className="size-4" aria-hidden />
              </button>
            </div>
          </form>
        </div>
      )}

      {detailAttraction && (
        <div
          role="presentation"
          onMouseDown={() => setDetailAttraction(null)}
          className="fixed inset-0 z-[60] grid place-items-center bg-foreground/50 p-5"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`${detailAttraction.name} 상세정보`}
            onMouseDown={(event) => event.stopPropagation()}
            className="relative max-h-[calc(100dvh-40px)] w-[min(32rem,100%)] overflow-y-auto border border-border bg-background"
          >
            <button
              type="button"
              onClick={() => setDetailAttraction(null)}
              aria-label="상세정보 닫기"
              className="absolute top-3 right-3 z-10 grid size-9 place-items-center rounded-full bg-background/90 text-foreground"
            >
              <X className="size-5" aria-hidden />
            </button>
            {detailAttraction.image && (
              <div className="relative aspect-[16/10] bg-muted">
                <img
                  src={detailAttraction.image}
                  alt={`${detailAttraction.name} 대표 사진`}
                  className="size-full object-cover"
                />
              </div>
            )}
            <div className="flex flex-col gap-4 p-6">
              <Eyebrow>{detailAttraction.recommendationType === "distance" ? "거리순 추천" : "인기순 추천"}</Eyebrow>
              <h2 className="font-serif text-3xl">{detailAttraction.name}</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {detailAttraction.description || "등록된 상세 설명이 없습니다."}
              </p>
              <dl className="grid border-t border-border text-sm">
                <div className="grid grid-cols-[88px_1fr] gap-3 border-b border-border py-3">
                  <dt className="text-muted-foreground">테마</dt>
                  <dd>{detailAttraction.theme || "-"}</dd>
                </div>
                <div className="grid grid-cols-[88px_1fr] gap-3 border-b border-border py-3">
                  <dt className="text-muted-foreground">주소</dt>
                  <dd>{detailAttraction.address || "-"}</dd>
                </div>
                {detailAttraction.roadDistanceKm != null && (
                  <div className="grid grid-cols-[88px_1fr] gap-3 border-b border-border py-3">
                    <dt className="text-muted-foreground">숙소 기준 거리</dt>
                    <dd>{detailAttraction.roadDistanceKm}km</dd>
                  </div>
                )}
              </dl>
            </div>
          </section>
        </div>
      )}

      {result && <TripResultDialog itinerary={result.itinerary} url={result.url} onClose={() => setResult(null)} />}
      {attract && demo.example && (
        <ShareDialog
          url={`${kioskShareOrigin()}/planner/trip/${demo.example.shareId}?from=kiosk`}
          title={demo.example.title || "예시 일정"}
          heading="이렇게 휴대폰으로 가져가요"
          onClose={() => {}}
        />
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        hidden={attract}
        className="flex items-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm text-primary-foreground shadow-lg transition-colors hover:bg-primary/85"
      >
        {open ? <X className="size-4" aria-hidden /> : <MessageCircle className="size-4" aria-hidden />}
        AI 컨시어지
      </button>
    </div>
  )
}

