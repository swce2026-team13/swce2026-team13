"use client";
import { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Notice, Tag } from "@/components/ui";
import { useCampus } from "@/features/navigation/campus-provider";
import { api } from "@/shared/utils/api";
import type { Insight } from "@/shared/types/insight";
export default function Screen() {
  const { busy, insight, setInsight, run } = useCampus();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const authRevision = useRef(0);
  useEffect(() => {
    let cancelled = false;
    const revision = authRevision.current;
    api<Insight>("admin/insights")
      .then((value) => {
        if (!cancelled && revision === authRevision.current) setInsight(value);
      })
      .catch(() => {
        if (!cancelled && revision === authRevision.current) setInsight(null);
      });
    return () => {
      cancelled = true;
    };
  }, [setInsight]);
  return (
    <section className="content stack">
      <div className="row">
        <Tag tone="gray">관리자 전용</Tag>
        <Tag tone="amber">시연 경로 이용 기록</Tag>
      </div>
      <h1>어디에서 많이 헷갈릴까요?</h1>
      <p>
        피드백과 위치 재확인 신호를 통행량과 함께 살펴보고, 안내 개선 우선순위를
        정해요.
      </p>
      {!insight ? (
        <form
          className="card stack admin-login-card"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              authRevision.current++;
              try {
                await api("admin/login", { id, password });
                setInsight(await api<Insight>("admin/insights"));
              } finally {
                setPassword("");
              }
            });
          }}
        >
          <div className="admin-login-heading">
            <ShieldCheck className="blue-text" />
            <h3>관리자 인증</h3>
            <p>관리자 계정으로 로그인해 주세요.</p>
          </div>
          <label className="field-label admin-login-field">
            아이디
            <input
              autoComplete="username"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="관리자 아이디"
              required
            />
          </label>
          <label className="field-label admin-login-field">
            비밀번호
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="관리자 비밀번호"
              required
            />
          </label>
          <button
            className="button primary"
            disabled={busy || !id || !password}
          >
            로그인
          </button>
          <p className="small">로그인 상태는 8시간 동안 유지돼요.</p>
        </form>
      ) : (
        <>
          <div className="stats-grid">
            {[
              ["지점 통과", `${insight.passages}건`, "세션·지점별 중복 제외"],
              [
                "혼란 신호",
                `${insight.confusions}건`,
                "피드백·위치 재확인 합집합",
              ],
              ["전체 혼란 비율", `${insight.rate}%`, "혼란 신호 ÷ 지점 통과"],
              [
                "검토 지점",
                `${insight.points.filter((p) => p.confusions > 0).length}곳`,
                "혼란 신호가 있는 지점",
              ],
            ].map(([a, b, c]) => (
              <div className="card stat" key={a}>
                <small>{a}</small>
                <strong>{b}</strong>
                <small>{c}</small>
              </div>
            ))}
          </div>
          <div className="between">
            <h3>혼란 지점 우선순위</h3>
            <Tag>비율순</Tag>
          </div>
          <p className="small">
            전체 기간 · 지점별로 같은 세션을 한 번만 집계해요.
          </p>
          {insight.points.length === 0 && (
            <Notice>
              아직 안내 기록이 없어요. 길찾기를 사용하면 통계가 쌓여요.
            </Notice>
          )}
          {insight.points.map((p, i) => (
            <div
              className={`card insight-point ${i === 0 ? "selected" : ""}`}
              key={p.id}
            >
              <div className="row">
                <span className="rank">{i + 1}</span>
                <b>{p.name}</b>
              </div>
              <div className="between">
                <span className="small muted">
                  혼란 {p.confusions}건 / 통과 {p.passages}건
                </span>
                <strong className="blue-text">{p.rate}%</strong>
              </div>
              <progress value={p.rate} max={100} />
            </div>
          ))}
          <p className="small">
            제출된 피드백 {insight.feedbacks}건 · 수동 도착 확인 기반
          </p>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() =>
              run(async () => {
                authRevision.current++;
                setInsight(await api<Insight>("admin/insights"));
              })
            }
          >
            통계 새로고침
          </button>
          <button
            className="text-button centered"
            disabled={busy}
            onClick={() =>
              run(async () => {
                authRevision.current++;
                await api("admin/logout", {});
                setId("");
                setPassword("");
                setInsight(null);
              })
            }
          >
            관리자 로그아웃
          </button>
        </>
      )}
    </section>
  );
}
