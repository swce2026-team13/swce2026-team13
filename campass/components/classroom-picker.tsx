"use client";

import { useEffect, useState } from "react";
import { places, type Place } from "@/lib/catalog";
import { api } from "./campus-provider";

const normalizeRoom = (value: string) =>
  value.replace(/강의실|호|\s/g, "").toLowerCase();

// '541', 'H04', '541호 H04' 어느 쪽으로 입력해도 찾음
const roomKeys = (p: Place) =>
  [p.name, p.number ?? "", p.name.replace(/^\S+호\s*/, "")]
    .map(normalizeRoom)
    .filter(Boolean);

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
  const [rooms, setRooms] = useState(() => {
    const known = places.filter(
      (p) => p.category === "classroom" && p.building === building.name,
    );
    return initialRoom?.building === building.name &&
      !known.some((p) => p.id === initialRoom.id)
      ? [...known, initialRoom]
      : known;
  });
  // 호실은 서버 장소 목록에만 있어 건물을 고르면 불러옴
  useEffect(() => {
    let cancelled = false;
    api<{ places: Place[] }>(
      `places?category=classroom&building=${encodeURIComponent(building.name)}`,
    )
      .then((value) => {
        if (!cancelled && value.places.length) setRooms(value.places);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [building.name]);
  const room = roomInput.trim()
    ? rooms.find((p) => roomKeys(p).includes(normalizeRoom(roomInput)))
    : undefined;
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
