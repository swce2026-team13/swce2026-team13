"use client";

import { BusFront, DoorOpen } from "lucide-react";
import { mapEntrances, type PlacedEntrancePin } from "./map-entrances";

export function EntrancePins({
  pins,
  selected,
  onSelect,
  selectable,
  highlighted = [],
  current,
}: {
  pins: PlacedEntrancePin[];
  selected: string[];
  onSelect?: (id: string) => void;
  selectable?: string[];
  highlighted?: string[];
  current?: string;
}) {
  return (
    <div className="map-entrance-layer">
      {pins.map((position) => {
        const pin = mapEntrances.find((item) => item.id === position.id)!;
        const interactive = Boolean(
          onSelect && (!selectable || selectable.includes(pin.id)),
        );
        const Tag = interactive ? "button" : "span";
        return (
          <div key={pin.id}>
            <svg className="map-entrance-tail" aria-hidden="true">
              <line
                x1={position.x}
                y1={position.y}
                x2={Math.max(
                  position.left,
                  Math.min(position.x, position.left + position.width),
                )}
                y2={Math.max(
                  position.top,
                  Math.min(position.y, position.top + 22),
                )}
              />
            </svg>
            <i
              className="map-entrance-dot"
              aria-hidden="true"
              style={{ left: position.x, top: position.y }}
            />
            <Tag
              type={interactive ? "button" : undefined}
              className={`map-entrance-button${interactive ? "" : " map-entrance-static"}`}
              aria-label={`${pin.label}${interactive ? (pin.start ? " 출발" : " · 길안내 준비 중") : ""}`}
              aria-pressed={interactive ? selected.includes(pin.id) : undefined}
              data-start={pin.start ? "true" : undefined}
              data-route-state={
                current === pin.id
                  ? "current"
                  : highlighted.includes(pin.id)
                    ? "route"
                    : undefined
              }
              data-selected={selected.includes(pin.id)}
              data-side={position.side}
              style={{
                left: position.left - 6,
                top: position.top - 11,
                width: position.width + 12,
              }}
              onClick={interactive ? () => onSelect?.(pin.id) : undefined}
            >
              <span className="map-entrance-pill">
                <span className="map-entrance-icon" aria-hidden="true">
                  {pin.kind === "bus" ? (
                    <BusFront size={11} />
                  ) : pin.kind === "parking" ? (
                    "P"
                  ) : (
                    <DoorOpen size={11} />
                  )}
                </span>
                {pin.label}
              </span>
            </Tag>
          </div>
        );
      })}
    </div>
  );
}
