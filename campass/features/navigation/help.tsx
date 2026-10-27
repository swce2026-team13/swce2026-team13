"use client";

import { Compass, Info } from "lucide-react";
import { campus, sources } from "@/shared/utils/catalog";
import { Notice } from "@/components/ui";
import { useCampus } from "@/features/navigation/campus-provider";

export default function Screen() {
  const { go } = useCampus();

  return (
    <section className="content stack">
      <span className="icon-box">
        <Compass strokeWidth={1.65} />
      </span>

      <h1>CAMPASS 이렇게 써요</h1>

      <p>
        처음 오는 {campus.name} 캠퍼스에서도 지도와 사진 인식을 이용해
        목적지까지 찾아갈 수 있어요.
      </p>

      <div className="card stack">
        <h3>이렇게 이용하세요</h3>

        <div>
          <b>1. 안내 방법을 골라요</b>
          <p>
            검색창에 물어보거나 바로 찾기에서 목적지를 고를 수 있어요.
            건물·강의실과 편의시설도 찾아볼 수 있어요.
          </p>
        </div>

        <div>
          <b>2. 지도를 보며 걸어가요</b>
          <p>
            현재 경로와 다음 이동 지점을 지도에서 확인할 수 있어요.
            다음 지점에 도착하면 ‘다음 지점에 도착했어요’를 눌러 주세요.
          </p>
        </div>

        <div>
          <b>3. 헷갈리면 사진을 찍어요</b>
          <p>
            ‘길을 잃었어요’를 누르고 주변을 촬영하면 현재 위치를 다시
            확인할 수 있어요.
          </p>
        </div>

        <div>
          <b>4. 계단이 불편하다면</b>
          <p>
            길찾기에서 엘리베이터 이동 조건을 선택하면 가능한 경로를
            안내해요.
          </p>
        </div>

        <div>
          <b>5. 내 위치는 저장하지 않아요</b>
          <p>
            이동하는 동안 위치를 계속 추적하지 않고, 찍은 사진은 위치
            확인에만 사용해요.
          </p>
        </div>
      </div>

      <Notice tone="amber">
        <b className="row">
          <Info size={18} strokeWidth={1.65} />
          현재 지도 안내
        </b>
        <p>
          현재 길안내에서는 2D 대체 지도를 사용하고 있어요. 건물·층·연결
          정보는 실제 캠퍼스 데이터를 기준으로 제공하며, 지도 안내는 현장
          상황과 다를 수 있어요.
        </p>
      </Notice>

      <a
        className="button secondary"
        href={sources.map}
        target="_blank"
        rel="noreferrer"
      >
        공식 캠퍼스맵 보기
      </a>

      <button
        className="button primary"
        onClick={() => go("home")}
      >
        목적지 찾아보기
      </button>

      <p className="fine-print">
        검색 문장을 해석하기 위해 AI를 사용할 수 있어요. 이름이나 연락처
        같은 개인정보는 입력하지 마세요.
      </p>
    </section>
  );
}