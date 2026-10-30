"use client";

import { BusFront, DoorOpen } from "lucide-react";
import { mapEntrances, type PlacedEntrancePin } from "./map-entrances";

export function EntrancePins({ pins, selected, onSelect }: {
  pins: PlacedEntrancePin[];
  selected: string[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="map-entrance-layer">
      {pins.map((position) => {
        const pin = mapEntrances.find((item) => item.id === position.id)!;
        return (
          <div key={pin.id}>
            <svg className="map-entrance-tail" aria-hidden="true">
              <line x1={position.x} y1={position.y}
                x2={position.left + position.width / 2} y2={position.top + 11} />
            </svg>
            <i className="map-entrance-dot" aria-hidden="true" style={{ left: position.x, top: position.y }} />
            <button type="button" className="map-entrance-button"
              aria-label={`${pin.label}${pin.start ? " 출발" : " · 길안내 준비 중"}`}
              aria-pressed={selected.includes(pin.id)}
              data-side={position.side}
              style={{ left: position.left - 6, top: position.top - 11, width: position.width + 12 }}
              onClick={() => onSelect(pin.id)}>
              <span className="map-entrance-pill">
                <span className="map-entrance-icon" aria-hidden="true">
                  {pin.kind === "bus" ? <BusFront size={11} /> : pin.kind === "parking" ? "P" : <DoorOpen size={11} />}
                </span>
                {pin.label}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
