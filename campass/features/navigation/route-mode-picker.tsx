"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Building, PersonStanding, MoveUpRight } from "lucide-react";
import { api } from "./campus-provider";
import type { Route, RouteOption } from "@/shared/utils/routing";
import {
  routeMode,
  routeModeLabel,
  routeEnvironment,
  displayedRouteOption,
} from "@/shared/utils/route-presentation";

type Mode = "hill" | "stairs";
export function RouteModePicker({
  start,
  destination,
  elevator,
  route,
  selected,
  busy,
  onOption,
  onElevator,
}: {
  start: string;
  destination: string;
  elevator: boolean;
  route: Route | null;
  selected?: RouteOption;
  busy: boolean;
  onOption: (id: string) => void;
  onElevator: (value: boolean) => void;
}) {
  const radioName = useId();
  const key = JSON.stringify([start, destination]);
  const [available, setAvailable] = useState<{
    key: string;
    normal: RouteOption[];
    lift: RouteOption[];
  }>({ key: "", normal: [], lift: [] });
  const preferred = useRef<Mode>("hill");
  const pending = useRef<Mode | null>(null);
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
  const normal = loaded
    ? available.normal
    : !elevator
      ? (route?.options ?? [])
      : [];
  const lift = loaded ? available.lift : elevator ? (route?.options ?? []) : [];
  const options = route?.options ?? [];
  // 조건을 바꾼 뒤 새 후보가 도착했을 때만 기존 후보 선택 함수를 호출한다.
  useEffect(() => {
    if (!route || !selected) return;
    const option = displayedRouteOption(
      route.options,
      selected,
      elevator,
      pending.current,
    );
    pending.current = null;
    if (option && option.id !== selected.id) onOption(option.id);
  }, [route, selected, elevator, onOption]);
  const missing = (["hill", "stairs"] as const).filter(
    (mode) => !normal.some((o) => routeMode(o) === mode),
  );
  return (
    <div className="route-mode-section">
      <div className="route-mode-row">
        <div
          className="route-mode-tabs"
          role="radiogroup"
          aria-label="가는 길 선택"
        >
          {(["hill", "stairs"] as const).map((mode) => {
            const option = options.find((o) => routeMode(o) === mode);
            const Icon =
              mode === "hill"
                ? PersonStanding
                : option && routeEnvironment(option) === "indoor"
                  ? Building
                  : MoveUpRight;
            const disabled = busy || elevator || !option;
            return (
              <label key={mode} className={disabled ? "disabled" : ""}>
                <input
                  className="sr-only"
                  type="radio"
                  name={radioName}
                  value={mode}
                  aria-label={
                    option
                      ? routeModeLabel(option)
                      : mode === "hill"
                        ? "실외 길 (언덕길)"
                        : "실외 길 (계단길)"
                  }
                  checked={
                    !elevator &&
                    Boolean(selected && routeMode(selected) === mode)
                  }
                  aria-describedby={
                    missing.includes(mode) ? "route-mode-reason" : undefined
                  }
                  disabled={disabled}
                  onChange={() => {
                    preferred.current = mode;
                    if (option) onOption(option.id);
                  }}
                />
                <span>
                  <Icon size={21} aria-hidden="true" />
                </span>
              </label>
            );
          })}
        </div>
        <div className="route-elevator-control">
          <span>엘리베이터</span>
          <button
            type="button"
            className={`switch ${elevator ? "on" : ""}`}
            role="switch"
            aria-label="엘리베이터"
            aria-checked={elevator}
            disabled={
              busy ||
              (elevator &&
                loaded &&
                !normal.some((o) => routeMode(o) !== "elevator")) ||
              (!elevator &&
                (!loaded || !lift.some((o) => routeMode(o) === "elevator")))
            }
            onClick={() => {
              if (elevator) pending.current = preferred.current;
              onElevator(!elevator);
            }}
          >
            <span />
          </button>
        </div>
      </div>
      <p className="route-mode-reason" id="route-mode-reason" role="status">
        {!start || !destination
          ? "출발지와 도착지를 골라 주세요."
          : !loaded
            ? "이용 가능한 길을 확인하고 있어요."
            : [
                elevator ? "엘리베이터 길만 보여 드려요." : "",
                ...missing.map(
                  (mode) =>
                    `${mode === "hill" ? "언덕길" : "계단길"}은 이 구간에 없어요.`,
                ),
                !lift.some((o) => routeMode(o) === "elevator")
                  ? "엘리베이터 길은 이 구간에 없어요."
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
      </p>
    </div>
  );
}
