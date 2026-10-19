"use client";
import { Compass, Info } from "lucide-react";
import { campus, sources } from "@/lib/catalog";
import { Notice } from "@/components/ui";
import { useCampus } from "@/components/campus-provider";
export default function Screen() {
  const { go } = useCampus();
  return (
    <section className="content stack">
      <span className="icon-box">
        <Compass />
      </span>

      <h1>
        CAMPASS 이렇게 써요
      </h1>

      <p>{campus.name} 캠퍼스를 3D 지도와 사진 인식으로 안내해 드려요.</p>
      
      <div className="card stack">
      <h3>이렇게 이용하세요</h3>

      <div>
      <b>1. 안내 방법을 골라요</b>
      <p>
        검색창에 물어보거나 ‘바로 찾기’에서 골라요.
        편의시설은 지도 핀으로 위치와 운영 시간을 보여줘요.
      </p>
      </div>

      <div>
      <b>2. 3D 지도를 보며 걸어가요</b>
      <p>
        건물마다 층과 연결통로가 3D 지도에 표시돼요.
        다음 건물에 닿으면 ‘다음 지점에 도착했어요’를 눌러 주세요.
      </p>
    </div>

    <div>
      <b>3. 헷갈리면 사진을 찍어요</b>
      <p>
        ‘길을 잃었어요’를 누르고 주변을 찍으면,
        지금 서 있는 곳부터 다시 알려드려요.
      </p>
    </div>

    <div>
      <b>4. 계단이 불편하다면</b>
      <p>
        ‘엘리베이터로 갈래요’라고 말하거나 길찾기에서
        ‘엘리베이터로 이동’을 켜면 계단 없는 길로 안내해요.
      </p>
    </div>

    <div>
      <b>5. 내 위치는 저장하지 않아요</b>
      <p>
        이동하는 동안 위치를 계속 따라다니지 않고,
        찍은 사진은 위치 확인에만 써요.
      </p>
    </div>
  </div>
      <Notice tone="amber">
        <b className="row">
          <Info size={18} />
          시연 안내
        </b>
        <p>
          건물·일부 강의실은 공식 자료에 기반합니다. 사진, 거리, 실내 경로, 면접
          장소는 예시이며 현장 검증 전입니다. 사진 인식 API 미설정 시 직접
          선택으로 안내합니다.
        </p>
      </Notice>
      <a
        className="button secondary"
        href={sources.map}
        target="_blank"
        rel="noreferrer"
      >
        공식 캠퍼스맵 보기 ↗
      </a>
      <button className="button primary" onClick={() => go("home")}>
        목적지 찾아보기
      </button>
    </section>
  );
}
