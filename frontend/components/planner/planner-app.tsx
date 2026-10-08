"use client";

import { PanelRightOpen, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  DURATIONS,
  FIXED_START_LOCATION,
  MAX_STOPS,
  PLANNER_ADD_STORAGE_KEY,
  durationForDays,
  optimizeRoute,
  rememberSavedTrip,
  requestItinerary,
  saveTrip,
  todayText,
  type AssistAction,
  type Companion,
  type Destination,
  type DurationId,
  type Itinerary,
  type StartLocation,
} from "@/lib/planner";
import { PlannerHeader } from "./planner-header";
import {
  AssistantPanel,
  usePlannerAssistant,
  type PanelMode,
} from "./assistant-panel";
import { DestinationBrowser } from "./destination-browser";
import { DestinationDrawer } from "./destination-drawer";
import { ItineraryView } from "./itinerary-view";
import { PlanBar } from "./plan-bar";
import { SideRail } from "./side-rail";
import { TripSettings } from "./trip-settings";

const PLAN_STORAGE_KEY = "stay-sync.planner.v2";
// 공유 페이지에서 "이 일정으로 계획하기"를 누르면 여기에 담아 플래너로 넘긴다.
export const TEMPLATE_STORAGE_KEY = "stay-sync.planner.template";

type Tab = "browse" | "itinerary";

type PlanState = {
  sessionId: string;
  durationId: DurationId;
  startDate: string;
  startLocation: StartLocation | null;
  // 출발지를 일산 킨텍스로 고정할지 (기본 고정, 출발지 칸의 숨은 버튼으로 풀 수 있다)
  originLocked: boolean;
  // 숙소(1박 이상일 때만 쓴다)와 동행자 유형
  accommodation: StartLocation | null;
  companion: Companion | null;
  selected: Destination[];
  itinerary: Itinerary | null;
  itineraryIds: number[]; // 일정을 만들 때 담겨 있던 곳 (바뀌면 "다시 만들기" 안내)
  shareId: string | null;
  tab: Tab;
};

function initialState(): PlanState {
  return {
    sessionId: "",
    durationId: "1n2d",
    startDate: todayText(1),
    startLocation: null,
    originLocked: true,
    accommodation: null,
    companion: null,
    selected: [],
    itinerary: null,
    itineraryIds: [],
    shareId: null,
    tab: "browse",
  };
}

function sameIds(a: number[], b: number[]) {
  return a.length === b.length && [...a].sort().join() === [...b].sort().join();
}

/**
 * AI 동선 플래너 — 기본 화면과 같은 백엔드 로직(테마 추천, 도로망 동선, 여행 스토리, 날씨)을
 * "조건 정하기 → 여행지 담기 → 일정 확인·편집 → 저장·공유" 흐름으로 쓰는 두 번째 인터페이스.
 */
export function PlannerApp() {
  const [plan, setPlan] = useState<PlanState>(initialState);
  const [restored, setRestored] = useState(false);
  const [region, setRegion] = useState("");
  // 조건 초기화 때 목록(테마·검색어)을 새로 그리기 위한 키와, 테마·검색어가 걸려 있는지
  const [filterKey, setFilterKey] = useState(0);
  const [filterActive, setFilterActive] = useState(false);
  const [drawer, setDrawer] = useState<Destination | null>(null);
  // AI 컨시어지는 접힌 채로 시작한다(필요할 때 펼친다).
  const [panelMode, setPanelMode] = useState<PanelMode>("collapsed");
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  const update = useCallback(
    (patch: Partial<PlanState>) => setPlan((prev) => ({ ...prev, ...patch })),
    [],
  );

  // 저장된 계획(또는 공유 일정 템플릿)을 마운트 후 복원한다(서버 렌더와 어긋나지 않게).
  useEffect(() => {
    let next = initialState();
    try {
      const saved = JSON.parse(
        window.sessionStorage.getItem(PLAN_STORAGE_KEY) || "null",
      );
      if (saved?.sessionId) next = { ...next, ...saved };
      const template = JSON.parse(
        window.sessionStorage.getItem(TEMPLATE_STORAGE_KEY) || "null",
      );
      if (template?.selected) {
        next = {
          ...next,
          ...template,
          shareId: null,
          tab: template.itinerary ? "itinerary" : "browse",
        };
        window.sessionStorage.removeItem(TEMPLATE_STORAGE_KEY);
      }
      // 순위 화면에서 "이 곳들로 동선 만들기"로 넘어온 여행지는 이미 담은 곳 뒤에 더한다.
      const added: Destination[] | null = JSON.parse(
        window.sessionStorage.getItem(PLANNER_ADD_STORAGE_KEY) || "null",
      );
      if (Array.isArray(added) && added.length > 0) {
        const have = new Set(next.selected.map((d) => d.id));
        const fresh = added.filter((d) => !have.has(d.id));
        next = {
          ...next,
          selected: [...next.selected, ...fresh].slice(0, MAX_STOPS),
          shareId: null,
          tab: "browse",
        };
        window.sessionStorage.removeItem(PLANNER_ADD_STORAGE_KEY);
      }
    } catch {}
    if (!next.sessionId) next.sessionId = crypto.randomUUID();
    if (!DURATIONS.some((d) => d.id === next.durationId))
      next.durationId = "1n2d";
    if (next.startDate && next.startDate < todayText())
      next.startDate = todayText(1);
    setPlan(next);
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      window.sessionStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan));
    } catch {}
  }, [restored, plan]);

  const duration =
    DURATIONS.find((d) => d.id === plan.durationId) ?? DURATIONS[1];
  const selectedIds = plan.selected.map((d) => d.id);
  const { route, totalKm } = useMemo(
    () => optimizeRoute(plan.selected),
    [plan.selected],
  );
  const staleIds =
    Boolean(plan.itinerary) && !sameIds(selectedIds, plan.itineraryIds);
  const building = busyLabel !== null;
  const effectiveStart = plan.originLocked
    ? FIXED_START_LOCATION
    : plan.startLocation;
  const effectiveStay = duration.days > 1 ? plan.accommodation : null;
  // 일정을 만든 뒤 숙소·동행자를 바꾸면 "다시 만들기"를 안내한다.
  const settingsChanged =
    Boolean(plan.itinerary) &&
    ((plan.itinerary?.companion ?? null) !== (plan.companion ?? null) ||
      (plan.itinerary?.accommodation?.name ?? null) !==
        (effectiveStay?.name ?? null));
  const stale = staleIds || settingsChanged;

  function toggle(d: Destination) {
    setPlan((prev) => ({
      ...prev,
      selected: prev.selected.some((s) => s.id === d.id)
        ? prev.selected.filter((s) => s.id !== d.id)
        : prev.selected.length >= MAX_STOPS
          ? prev.selected
          : [...prev.selected, d],
    }));
  }

  function addAll(items: Destination[]) {
    setPlan((prev) => {
      const ids = new Set(prev.selected.map((s) => s.id));
      const added = items.filter((d) => !ids.has(d.id));
      return {
        ...prev,
        selected: [...prev.selected, ...added].slice(0, MAX_STOPS),
      };
    });
  }

  function showTab(tab: Tab) {
    update({ tab });
    mainRef.current?.scrollTo({ top: 0 });
  }

  async function buildItinerary({
    dayGroups,
    days = duration.days,
  }: { dayGroups?: number[][]; days?: number } = {}) {
    if (building) return;
    const ids = dayGroups ? dayGroups.flat() : route.map((d) => d.id);
    if (ids.length === 0) return;
    setBusyLabel(
      dayGroups
        ? "바꾼 일정으로 동선을 다시 계산하고 있습니다"
        : "도로망 기준 동선과 시간표, 날씨를 준비하고 있습니다",
    );
    try {
      const itinerary = await requestItinerary({
        sessionId: plan.sessionId,
        attractionIds: ids,
        days,
        startDate: plan.startDate || null,
        startLocation: effectiveStart,
        accommodation: days > 1 ? plan.accommodation : null,
        companion: plan.companion,
        dayGroups,
      });
      const keptIds = itinerary.days.flatMap((d) => d.stops.map((s) => s.id));
      setPlan((prev) => ({
        ...prev,
        itinerary,
        itineraryIds: keptIds,
        // 일정에서 뺀 곳은 담은 목록에서도 뺀다.
        selected: dayGroups
          ? prev.selected.filter((s) => keptIds.includes(s.id))
          : prev.selected,
        shareId: null,
        tab: "itinerary",
      }));
      mainRef.current?.scrollTo({ top: 0 });
      const rainy = itinerary.days
        .filter((d) => d.weather?.indoorRecommended)
        .map((d) => `${d.day}일 차`);
      assistant.append({
        role: "bot",
        text:
          `${itinerary.title}을 ${dayGroups ? "다시 " : ""}만들었어요. ${itinerary.days.length}일 동안 ${keptIds.length}곳, 차량으로 약 ${itinerary.totalKm}km예요.` +
          (rainy.length
            ? `\n${rainy.join(", ")}에는 비·폭염 예보가 있어요. 실내 여행지를 섞어 보는 건 어떨까요?`
            : "") +
          "\n마음에 들면 저장해서 링크로 공유할 수 있어요.",
        showItinerary: true,
      });
    } catch (error) {
      assistant.append({
        role: "bot",
        isError: true,
        text:
          (error as Error).message ||
          "일정을 만들지 못했어요. 잠시 후 다시 시도해주세요.",
      });
    } finally {
      setBusyLabel(null);
    }
  }

  async function save() {
    if (!plan.itinerary || saving) return;
    setSaving(true);
    try {
      const { shareId } = await saveTrip({
        sessionId: plan.sessionId,
        itinerary: plan.itinerary,
      });
      rememberSavedTrip(shareId);
      update({ shareId });
      assistant.append({
        role: "bot",
        text: `일정을 저장했어요. 링크를 복사해 함께 가는 분들과 나눠 보세요.\n${window.location.origin}/planner/trip/${shareId}`,
      });
    } catch (error) {
      assistant.append({
        role: "bot",
        isError: true,
        text: (error as Error).message || "일정을 저장하지 못했어요.",
      });
    } finally {
      setSaving(false);
    }
  }

  const defaults = initialState();
  const conditionsChanged =
    plan.durationId !== defaults.durationId ||
    plan.startDate !== defaults.startDate ||
    !plan.originLocked ||
    plan.startLocation !== null ||
    plan.accommodation !== null ||
    plan.companion !== null ||
    region !== "" ||
    filterActive;

  // 조건 초기화 — 여행 조건(기간·출발일·출발지·숙소·동행)과 목록 필터(지역·테마·검색)만 처음으로. 담은 곳·일정은 그대로 둔다.
  function resetConditions() {
    update({
      durationId: defaults.durationId,
      startDate: defaults.startDate,
      startLocation: null,
      originLocked: true,
      accommodation: null,
      companion: null,
    });
    setRegion("");
    setFilterKey((k) => k + 1);
    setFilterActive(false);
  }

  // 처음부터 새로 계획 — 담은 곳·일정·공유·AI 대화에 여행 조건과 목록 필터까지 모두 처음 상태로.
  function startOver() {
    if (building) return;
    const hasWork =
      plan.selected.length > 0 || plan.itinerary || conditionsChanged;
    if (
      hasWork &&
      !window.confirm(
        "담은 여행지, 만든 일정, AI 대화, 여행 조건이 모두 초기화돼요. 처음부터 새로 계획할까요?",
      )
    )
      return;
    assistant.reset();
    setDrawer(null);
    resetConditions();
    update({
      sessionId: crypto.randomUUID(),
      selected: [],
      itinerary: null,
      itineraryIds: [],
      shareId: null,
      tab: "browse",
    });
    mainRef.current?.scrollTo({ top: 0 });
  }
  const canStartOver =
    plan.selected.length > 0 || Boolean(plan.itinerary) || conditionsChanged;

  // 대화 초기화 = 새 여행 계획. 대화·담은 곳·일정·공유 상태를 비우고, 여행 조건(기간·출발일·출발지)은 유지한다.
  function resetPlan() {
    if (building) return;
    const hasWork = plan.selected.length > 0 || plan.itinerary;
    if (
      hasWork &&
      !window.confirm(
        "대화와 담은 여행지, 만든 일정이 모두 초기화돼요. 새로 계획할까요?",
      )
    )
      return;
    assistant.reset();
    setRegion("");
    setDrawer(null);
    update({
      sessionId: crypto.randomUUID(),
      selected: [],
      itinerary: null,
      itineraryIds: [],
      shareId: null,
      tab: "browse",
    });
    mainRef.current?.scrollTo({ top: 0 });
  }

  function handleActions(actions: AssistAction[]) {
    for (const action of actions) {
      if (action.type === "setDays")
        update({ durationId: durationForDays(action.days).id });
      if (action.type === "recommend") setRegion(action.region);
      if (action.type === "setCompanion")
        update({ companion: action.companion });
      if (action.type === "clear")
        update({
          selected: [],
          itinerary: null,
          itineraryIds: [],
          shareId: null,
          tab: "browse",
        });
    }
    // 기간 변경과 일정 요청이 같이 오면 바뀐 기간으로 만든다. 최신 상태로 만들도록 ref를 거쳐 호출한다.
    if (actions.some((a) => a.type === "build")) {
      const setDays = actions.find((a) => a.type === "setDays");
      buildLatestRef.current(
        setDays && setDays.type === "setDays"
          ? durationForDays(setDays.days).days
          : undefined,
      );
    }
  }

  const buildLatestRef = useRef<(days?: number) => void>(() => {});
  buildLatestRef.current = (days) => buildItinerary({ days });

  const assistant = usePlannerAssistant({
    sessionId: plan.sessionId,
    getContext: () => ({
      selectedIds,
      days: duration.days,
      region: region || null,
      companion: plan.companion,
    }),
    onActions: handleActions,
  });

  return (
    <div className="flex h-dvh flex-col bg-background">
      <PlannerHeader />
      <div className="flex min-h-0 flex-1">
        <SideRail
          selected={plan.selected}
          onRemove={(id) =>
            update({ selected: plan.selected.filter((d) => d.id !== id) })
          }
          onOpen={setDrawer}
        />

        <main
          ref={mainRef}
          className={cn(
            "flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto px-5 py-6 lg:px-10 lg:py-8",
            panelMode === "fullscreen" && "hidden",
          )}
        >
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-col gap-2">
                <p className="text-[12px] uppercase tracking-[0.28em] text-muted-foreground">
                  Trip Planner · Gyeonggi North
                </p>
                <h1 className="text-balance font-serif text-3xl text-foreground">
                  {plan.tab === "itinerary"
                    ? "나의 여행 일정"
                    : "여행지 담고 동선 만들기"}
                </h1>
              </div>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={startOver}
                  disabled={!canStartOver || building}
                  className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                >
                  <RotateCcw className="size-3.5" aria-hidden />
                  처음부터 다시
                </button>
                <div
                  role="tablist"
                  aria-label="플래너 단계"
                  className="flex rounded-full border border-border p-1 text-[13px]"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={plan.tab === "browse"}
                    onClick={() => showTab("browse")}
                    className={cn(
                      "rounded-full px-4 py-1.5 transition-colors",
                      plan.tab === "browse"
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {`여행지 담기${plan.selected.length ? ` · ${plan.selected.length}` : ""}`}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={plan.tab === "itinerary"}
                    disabled={!plan.itinerary}
                    onClick={() => showTab("itinerary")}
                    className={cn(
                      "rounded-full px-4 py-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                      plan.tab === "itinerary"
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    내 일정
                  </button>
                </div>
              </div>
            </div>
            {plan.tab === "browse" && (
              <TripSettings
                durationId={plan.durationId}
                onDurationChange={(durationId) => update({ durationId })}
                startDate={plan.startDate}
                onStartDateChange={(startDate) => update({ startDate })}
                startLocation={plan.startLocation}
                onStartLocationChange={(startLocation) =>
                  update({ startLocation })
                }
                originLocked={plan.originLocked}
                onToggleOriginLock={() =>
                  update({ originLocked: !plan.originLocked })
                }
                accommodation={plan.accommodation}
                onAccommodationChange={(accommodation) =>
                  update({ accommodation })
                }
                companion={plan.companion}
                onCompanionChange={(companion) => update({ companion })}
                onReset={resetConditions}
                canReset={conditionsChanged}
              />
            )}
          </div>

          {plan.tab === "browse" ? (
            <>
              {/* 넓은 화면에서는 목록이 남는 높이를 채우고 안에서 스크롤한다. 높이가 모자라도 최소 높이를 지켜 아래 바에 가려지지 않게 한다. */}
              <div className="flex flex-col max-lg:order-3 lg:min-h-[24rem] lg:flex-1">
                <DestinationBrowser
                  key={filterKey}
                  onFilterActiveChange={setFilterActive}
                  region={region}
                  onRegionChange={setRegion}
                  selectedIds={selectedIds}
                  onToggle={toggle}
                  onOpen={setDrawer}
                  companion={plan.companion}
                />
              </div>
              <div className="max-lg:order-2">
                <PlanBar
                  route={route}
                  totalKm={totalKm}
                  durationLabel={duration.label}
                  days={duration.days}
                  onBuild={() => buildItinerary()}
                  building={building}
                  stale={stale}
                />
              </div>
            </>
          ) : (
            plan.itinerary && (
              <>
                {stale && (
                  <div className="flex flex-col gap-3 rounded-sm border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      담은 곳이 바뀌었어요. 새로 담은 곳까지 넣어 일정을 다시
                      만들까요?
                    </p>
                    <button
                      type="button"
                      onClick={() => buildItinerary()}
                      disabled={building}
                      className="h-9 rounded-sm bg-primary px-4 text-[13px] text-primary-foreground disabled:opacity-40"
                    >
                      일정 다시 만들기
                    </button>
                  </div>
                )}
                <ItineraryView
                  itinerary={plan.itinerary}
                  recalculating={building}
                  onRecalculate={(groups) =>
                    buildItinerary({ dayGroups: groups })
                  }
                  onAddMore={() => showTab("browse")}
                  onSave={save}
                  saving={saving}
                  shareId={plan.shareId}
                />
              </>
            )
          )}
        </main>

        {panelMode === "collapsed" ? (
          <div className="hidden border-l border-border lg:flex">
            <button
              type="button"
              onClick={() => setPanelMode("open")}
              className="flex w-14 flex-col items-center gap-4 py-6 text-muted-foreground transition-colors hover:text-foreground"
            >
              <PanelRightOpen
                className="size-4"
                strokeWidth={1.25}
                aria-hidden
              />
              <span className="size-1.5 rounded-full bg-accent" aria-hidden />
              <span className="text-xs tracking-[0.2em] [writing-mode:vertical-rl]">
                AI 여행 컨시어지
              </span>
            </button>
          </div>
        ) : (
          <aside
            className={cn(
              "min-h-0 flex-col border-l border-border bg-background",
              panelMode === "fullscreen"
                ? "flex flex-1"
                : "hidden w-96 lg:flex xl:w-[420px]",
            )}
          >
            <AssistantPanel
              assistant={assistant}
              busyLabel={busyLabel}
              mode={panelMode}
              onModeChange={setPanelMode}
              selectedIds={selectedIds}
              onToggle={toggle}
              onOpen={setDrawer}
              onAddAll={addAll}
              onShowItinerary={() => {
                if (panelMode === "fullscreen") setPanelMode("open");
                showTab("itinerary");
              }}
              onReset={resetPlan}
              canReset={
                assistant.messages.length > 0 ||
                plan.selected.length > 0 ||
                Boolean(plan.itinerary)
              }
            />
          </aside>
        )}
      </div>

      {panelMode !== "fullscreen" && (
        <button
          type="button"
          onClick={() => setPanelMode("fullscreen")}
          className="fixed bottom-5 right-5 z-[1000] flex h-12 items-center gap-2.5 rounded-full bg-primary px-6 text-[13px] tracking-wide text-primary-foreground shadow-lg lg:hidden"
        >
          <span className="size-1.5 rounded-full bg-accent" aria-hidden />
          AI 여행 컨시어지
        </button>
      )}

      {drawer && (
        <DestinationDrawer
          destination={drawer}
          selectedIds={selectedIds}
          onToggle={toggle}
          onOpen={setDrawer}
          onClose={() => setDrawer(null)}
        />
      )}
    </div>
  );
}
