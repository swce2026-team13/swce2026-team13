"use client";

import {
  AlertCircleIcon,
  ArrowRightIcon,
  CameraIcon,
  CheckIcon,
  ElevatorIcon,
  FoldedMapIcon,
  SearchLensIcon,
  ShieldIcon,
} from "@/components/ui/icons";

// 단계 카드 안의 버튼 · 검색칸은 실제 화면을 보여 주는 그림. 눌리지 않게 span으로 그림
const steps = [
  {
    title: "목적지를 정해요",
    text: "검색창에 말하듯 물어보거나, 홈의 바로 찾기에서 골라요.",
    sample: (
      <span className="help-sample-search">
        <span className="help-sample-search-icon"><SearchLensIcon size={18} /></span>
        혜인관 301호 어디예요?
        <span className="help-sample-send"><ArrowRightIcon size={14} /></span>
      </span>
    ),
  },
  {
    title: "지도를 보며 걸어요",
    text: "다음 지점에 도착하면 아래 버튼을 눌러 주세요.",
    sample: (
      <span className="help-sample-button primary">
        다음 지점에 도착했어요 <CheckIcon size={16} />
      </span>
    ),
  },
  {
    title: "헷갈리면 사진을 찍어요",
    text: "버튼을 누르고 주변을 찍으면 지금 위치를 다시 찾아줘요.",
    sample: (
      <span className="help-sample-button">
        <CameraIcon size={16} /> 길을 잃었어요
      </span>
    ),
  },
];

const notes = [
  {
    tone: "green",
    icon: <ShieldIcon size={20} />,
    title: "내 위치는 저장하지 않아요",
    text: "위치를 계속 추적하지 않고, 사진은 위치 확인에만 써요.",
  },
  {
    tone: "orange",
    icon: <FoldedMapIcon size={20} />,
    title: "지도는 현장과 다를 수 있어요",
    text: "지금은 2D 대체 지도로 안내해요. 현장 표지판도 함께 확인하세요.",
  },
  {
    tone: "blue",
    icon: <AlertCircleIcon size={20} />,
    title: "개인정보는 입력하지 마세요",
    text: "검색 문장을 이해하는 데 AI를 쓸 수 있어요. 이름·연락처는 넣지 마세요.",
  },
];

export default function Screen() {
  return (
    <section className="help">
      <div className="help-intro">
        <p className="help-lead">지도와 사진으로 목적지까지 안내해요.</p>
        <p className="help-sub">딱 세 단계만 기억하세요.</p>
      </div>

      <ol className="help-panel help-steps">
        {steps.map((step, i) => (
          <li key={step.title} className="help-step">
            <span className="help-step-number" aria-hidden="true">{i + 1}</span>
            <div className="help-step-body">
              <strong>{step.title}</strong>
              <p>{step.text}</p>
              <span className="help-sample" aria-hidden="true">{step.sample}</span>
            </div>
          </li>
        ))}
      </ol>

      <div className="help-panel help-elevator">
        <span className="help-elevator-icon"><ElevatorIcon size={24} /></span>
        <div>
          <strong>계단이 불편하다면</strong>
          <p>길찾기 화면에서 엘리베이터를 켜면 엘리베이터 길만 안내해요.</p>
        </div>
        <span className="help-switch" aria-hidden="true"><i /></span>
      </div>

      <section className="help-notes" aria-labelledby="help-notes-title">
        <h2 id="help-notes-title">알아두세요</h2>
        <ul className="help-panel">
          {notes.map((note) => (
            <li key={note.title} className="help-note">
              <span className={`help-note-icon ${note.tone}`}>{note.icon}</span>
              <div>
                <strong>{note.title}</strong>
                <p>{note.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
