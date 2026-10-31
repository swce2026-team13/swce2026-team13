"use client";
import { useEffect, useId, useState } from "react";
import { api } from "./campus-provider";
import type { Route, RouteOption } from "@/shared/utils/routing";
import type { HillMode } from "@/shared/utils/campus3d/route";
import {
  routeMode,
  routeNames,
  displayedRouteOption,
} from "@/shared/utils/route-presentation";
import { routeHint } from "@/shared/utils/route-summary";

// 길 카드 순서. 엘리베이터 길은 엘리베이터 조건 경로에서, 나머지는 일반 경로에서 찾음
const modes: HillMode[] = ["elevator", "hill", "stairs"];

// 경로를 다시 불러오는 동안 이 컴포넌트는 화면에서 빠졌다가 다시 그려짐.
// 그래서 「추천을 이미 적용한 출발·도착」과 「사용자가 고른 길 종류」는 컴포넌트 밖에 기억해 둠
let recommendedFor = "";
let pendingMode: "hill" | "stairs" | null = null;

export function RouteModePicker({
  start,
  destination,
  elevator,
  route,
  selected,
  busy,
  onOption,
  onElevator,
  onRecommended,
}: {
  start: string;
  destination: string;
  elevator: boolean;
  route: Route | null;
  selected?: RouteOption;
  busy: boolean;
  onOption: (id: string) => void;
  onElevator: (value: boolean) => void;
  // 추천한 길 종류. 요약 카드의 「추천」 표시도 같은 기준을 씀
  onRecommended?: (mode: HillMode | undefined) => void;
}) {
  const radioName = useId();
  const key = JSON.stringify([start, destination]);
  const [available, setAvailable] = useState<{
    key: string;
    normal: RouteOption[];
    lift: RouteOption[];
  }>({ key: "", normal: [], lift: [] });
  useEffect(() => {
    if (!start || !destination) return;
    let cancelled = false;
    Promise.all(
      [false, true].map((value) =>
        api<Route>("routes", { start, destination, elevator: value }).then(
          (r) => r.options,
          () => [],
        ),
      ),
    ).then(([normal, lift]) => {
      if (!cancelled) setAvailable({ key, normal, lift });
    });
    return () => {
      cancelled = true;
    };
  }, [key, start, destination]);
  const loaded = available.key === key;
  const normal = loaded ? available.normal : !elevator ? (route?.options ?? []) : [];
  const lift = loaded ? available.lift : elevator ? (route?.options ?? []) : [];
  // 조건을 바꾼 뒤 새 후보가 도착했을 때만 기존 후보 선택 함수를 호출한다.
  useEffect(() => {
    if (!route || !selected) return;
    const option = displayedRouteOption(route.options, selected, elevator, pendingMode);
    pendingMode = null;
    if (option && option.id !== selected.id) onOption(option.id);
  }, [route, selected, elevator, onOption]);

  // 방금 누른 길. 경로를 다시 불러오는 동안에도 그 카드가 선택된 채로 보이게 함
  const [choosing, setChoosing] = useState<{ key: string; mode: HillMode } | null>(null);
  const optionFor = (mode: HillMode) =>
    (mode === "elevator" ? lift : normal).find((o) => routeMode(o) === mode);
  const settled = elevator ? "elevator" : selected ? routeMode(selected) : null;
  // 다시 불러오는 동안(또는 고른 길로 바뀌기 직전까지)만 방금 누른 카드를 보여 줌
  const current = choosing?.key === key && (busy || !selected || choosing.mode !== settled)
    ? choosing.mode
    : settled;
  useEffect(() => {
    if (!choosing || busy || !selected || !route) return;
    // 고른 길로 실제로 바뀌었거나, 이 구간에 그 길이 없을 때만 방금 누른 표시를 지움
    // (중간에 다른 길이 잠깐 잡혀도 표시가 흔들리지 않게)
    if (routeMode(selected) === choosing.mode || !route.options.some((o) => routeMode(o) === choosing.mode))
      Promise.resolve().then(() => setChoosing(null));
  }, [choosing, busy, selected, route]);
  // 추천: 엘리베이터 조건으로 찾은 첫 길이 엘리베이터 길이면 그 길, 아니면 일반 경로의 첫 길
  const recommended: HillMode | undefined = lift.some((o) => routeMode(o) === "elevator")
    ? "elevator"
    : normal[0] ? routeMode(normal[0]) : undefined;

  // 처음 들어오면(출발·도착이 바뀔 때마다 한 번) 주소의 elevator 값과 상관없이 추천한 길을 고른 상태로 시작
  useEffect(() => {
    onRecommended?.(recommended);
    if (!loaded || !recommended || recommendedFor === key || busy) return;
    recommendedFor = key;
    if (current !== recommended) choose(recommended);
    // 추천이 정해지는 시점에만 맞춤
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, key, recommended]);

  function choose(mode: HillMode) {
    const option = optionFor(mode);
    if (!option || busy) return;
    setChoosing({ key, mode });
    if (mode === "elevator") {
      if (!elevator) onElevator(true);
      else onOption(option.id);
      return;
    }
    if (elevator) {
      pendingMode = mode;
      onElevator(false);
    } else onOption(option.id);
  }

  return (
    <section className="route-choice" aria-labelledby={`${radioName}-title`}>
      <h2 id={`${radioName}-title`}>어떤 길로 갈까요?</h2>
      <div className="route-choice-list" role="radiogroup" aria-labelledby={`${radioName}-title`}>
        {modes.map((mode) => {
          const option = optionFor(mode);
          // 이 구간에 없는 길 종류는 숨김
          if (loaded && !option) return null;
          const disabled = busy || !option;
          const checked = current === mode;
          return (
            <label key={mode} className={`route-choice-card${checked ? " is-checked" : ""}${disabled ? " is-disabled" : ""}`}>
              <input
                className="sr-only"
                type="radio"
                name={radioName}
                value={mode}
                checked={checked}
                disabled={disabled}
                onChange={() => choose(mode)}
              />
              <span className="route-choice-name">
                {routeNames[mode]}
                {recommended === mode && <em className="route-choice-badge">추천</em>}
              </span>
              <span className="route-choice-hint">{option ? routeHint(option) : ""}</span>
              <span className="route-choice-radio" aria-hidden="true" />
            </label>
          );
        })}
      </div>
      {!loaded && <p className="route-choice-status" role="status">이용 가능한 길을 확인하고 있어요.</p>}
    </section>
  );
}
