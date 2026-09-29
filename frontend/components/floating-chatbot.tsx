"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowRight, ArrowUp, MessageCircle, RotateCcw, X } from "lucide-react"
import { Eyebrow } from "@/components/section-heading"
import { MessageText } from "@/components/message-text"
import { ItineraryReply } from "@/components/itinerary-reply"
import { useConciergeChat } from "@/lib/concierge-chat"

export function FloatingChatbot() {
  const [open, setOpen] = useState(false)
  const {
    messages,
    input,
    setInput,
    isSending,
    currentStep,
    currentFacts,
    selectedAttractions,
    selectedRecommendations,
    suggestions,
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

  useEffect(() => {
    if (!open) return
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isSending, open])

  function sendMessage(event: React.FormEvent) {
    event.preventDefault()
    submitMessage(input)
  }

  return (
    <div className="fixed right-5 bottom-5 z-50 flex flex-col items-end gap-3 md:right-8 md:bottom-8">
      {open && (
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
              <button
                type="button"
                onClick={resetChat}
                disabled={isSending || messages.length <= 1}
                className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              >
                <RotateCcw className="size-3.5" aria-hidden />
                대화 초기화
              </button>
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

          <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-6" aria-live="polite">
            <div className="flex flex-col gap-2">
              <Eyebrow>Concierge</Eyebrow>
              <p className="font-serif text-2xl">어디로 떠나볼까요?</p>
            </div>

            {messages.map((message, messageIndex) => {
              const isLatest = messageIndex === lastIndex
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
                  <div key={message.id} className="flex flex-col gap-3 text-sm">
                    <p className="text-foreground">선택한 관광지로 여행 일정을 정리했어요.</p>
                    <ItineraryReply plan={message.plan} links={message.kakaoRouteLinks} />
                  </div>
                )
              }

              return (
                <div key={message.id} className="flex flex-col gap-3 text-sm">
                  <div className={message.isError ? "text-destructive" : "text-foreground"}>
                    <MessageText text={message.text} />
                  </div>

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
                        const selected = selectedRecommendations.some(({ id }) => id === recommendation.id)
                        const isDistance = recommendation.recommendationType === "distance"
                        const typeRank = message.recommendations!
                          .slice(0, recommendationIndex + 1)
                          .filter((item) => (item.recommendationType === "distance") === isDistance).length
                        const rank = recommendation.popularityPosition || typeRank
                        return (
                          <li key={recommendation.id} className="border-b border-border">
                            <div
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

            {isSending && (
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
              <ul className="absolute inset-x-0 bottom-full z-10 max-h-60 overflow-y-auto border-t border-border bg-background px-6">
                {suggestions.map((attraction) => (
                  <li key={attraction.id ?? attraction.kakaoPlaceId} className="border-b border-border last:border-b-0">
                    <button
                      type="button"
                      onClick={() => selectSuggestion(attraction)}
                      className="flex w-full flex-col gap-0.5 py-3 text-left text-sm transition-colors hover:text-accent"
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

            {currentStep === "ASK_SERVICE_TYPE" && (
              <p className="mb-3 flex flex-col gap-0.5 text-xs text-muted-foreground">
                <span className="text-foreground">① 경기북부 여행지를 먼저 입력해주세요</span>
                지원 지역 또는 해당 지역의 관광지명을 적어주세요.
              </p>
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

            <div className="flex items-center gap-3">
              <label htmlFor="chat-message" className="sr-only">
                메시지
              </label>
              <input
                id="chat-message"
                ref={inputRef}
                value={input}
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

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm text-primary-foreground shadow-lg transition-colors hover:bg-primary/85"
      >
        {open ? <X className="size-4" aria-hidden /> : <MessageCircle className="size-4" aria-hidden />}
        AI 컨시어지
      </button>
    </div>
  )
}
