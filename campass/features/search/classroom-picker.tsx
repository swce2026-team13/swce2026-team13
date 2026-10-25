"use client";

import { useState } from "react";
import { places, type Place } from "@/shared/utils/catalog";

export function ClassroomPicker({
  building,
  initialRoom,
  busy,
  onChoose,
  onBack,
}: {
  building: Place;
  initialRoom?: Place;
  busy: boolean;
  onChoose: (room: Place) => void;
  onBack: () => void;
}) {
  const [roomInput, setRoomInput] = useState(
    initialRoom?.name.replace(/호 강의실$/, "") || "",
  );
  const rooms = places.filter(
    (p) => p.category === "classroom" && p.building === building.name,
  );
  const normalizeRoom = (value: string) => value.replace(/강의실|호|\s/g, "");
  const room = rooms.find(
    (p) =>
      normalizeRoom(p.name) === normalizeRoom(roomInput) && roomInput.trim(),
  );
  return (
    <div className="card stack classroom-picker">
      <div className="between">
        <h3>{building.name} 강의실 찾기</h3>
        <button className="text-button" onClick={onBack}>
          건물 변경
        </button>
      </div>
      <p>찾으시는 호실을 직접 입력해 주세요.</p>
      <label className="field-label">
        호실
        <input
          type="text"
          maxLength={40}
          placeholder="예: 301 또는 시청각실 1"
          value={roomInput}
          onChange={(e) => setRoomInput(e.target.value)}
          aria-describedby="classroom-input-status"
        />
      </label>
      <p id="classroom-input-status" role="status" className="muted small">
        {rooms.length === 0
          ? "해당 건물의 강의실 정보가 아직 등록되지 않았어요."
          : !roomInput.trim()
            ? "호실을 입력해 주세요."
            : room
              ? `${room.floor} · ${room.name}`
              : "입력한 호실이 해당 건물에 등록되어 있지 않아요. 호실을 확인해 주세요."}
      </p>
      <button
        className="button primary"
        disabled={busy || !room}
        onClick={() => {
          if (room) onChoose(room);
        }}
      >
        이 강의실로 안내받기
      </button>
    </div>
  );
}
