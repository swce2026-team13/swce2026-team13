"use client";
import { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Notice, Tag } from "@/components/ui";
import { useCampus } from "@/components/campus-provider";
import { api, type Insight } from "@/components/campus-provider";
import { campusBuildings } from "@/lib/campus3d/types";
import { confusionReasons, improvementAdvice, levelTones, type ConfusionReason } from "@/lib/confusion-advice";
export default function Screen() {
  const { busy, insight, setInsight, run } = useCampus();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [period, setPeriod] = useState("all");
  const [building, setBuilding] = useState("");
  const [reason, setReason] = useState("");
  const [excludeDemo, setExcludeDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const params = new URLSearchParams({ period, demo: excludeDemo ? "exclude" : "include" });
  if (building) params.set("building", building);
  if (reason) params.set("reason", reason);
  const insightPath = `admin/insights?${params}`;
  const authRevision = useRef(0);
  useEffect(() => {
    let cancelled = false;
    const revision = authRevision.current;
    api<Insight>(insightPath)
      .then((value) => {
        if (!cancelled && revision === authRevision.current) setInsight(value);
      })
      .catch((error) => {
        if (cancelled || revision !== authRevision.current) return;
        if (error.status === 401) setInsight(null);
        else setLoadError("통계를 불러오지 못했어요. 새로고침해 주세요.");
      })
      .finally(() => {
        if (!cancelled && revision === authRevision.current) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [setInsight, insightPath]);
  function changeFilter(change: () => void) {
    setLoading(true);
    setLoadError("");
    change();
  }
  return (
    <section className="content stack admin-screen">
      <div className="row">
        <Tag tone="gray">관리자 전용</Tag>
      </div>
      <h1>어디에서 많이 헷갈릴까요?</h1>
      <p>
        피드백과 위치 재확인 신호를 통행량과 함께 살펴보고, 안내 개선 우선순위를
        정해요.
      </p>
      {!insight ? (
        <>
        <form
          className="card stack admin-login-card"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              authRevision.current++;
              try {
                await api("admin/login", { id, password });
                setInsight(await api<Insight>(insightPath));
              } finally {
                setPassword("");
              }
            });
          }}
        >
          <div className="admin-login-heading">
            <ShieldCheck className="blue-text" strokeWidth={1.65} />
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
        <p className="small">관리자 화면에는 사람을 알아볼 수 있는 정보가 없어요. 이용 기록은 안내 세션 단위로만 모아요.</p>
        </>
      ) : (
        <>
          {insight.demoSessions > 0 && (
            <div className="stack admin-demo">
              <Tag tone="amber">
                {excludeDemo ? "시연용 예시 데이터 제외" : "시연용 예시 데이터 포함"} · 세션 {insight.demoSessions}개
              </Tag>
              <label className="row">
                <input type="checkbox" checked={excludeDemo}
                  onChange={(e) => changeFilter(() => setExcludeDemo(e.target.checked))} />
                예시 빼고 보기
              </label>
            </div>
          )}
          <div className="stack admin-filters">
            <div className="chips" aria-label="기간">
              {[["all", "전체"], ["7d", "최근 7일"], ["today", "오늘"]].map(([value, label]) => (
                <button key={value} className={period === value ? "active" : ""}
                  aria-pressed={period === value}
                  onClick={() => changeFilter(() => setPeriod(value))}>{label}</button>
              ))}
            </div>
            <label className="field-label">건물
              <select value={building} onChange={(e) => changeFilter(() => setBuilding(e.target.value))}>
                <option value="">전체 건물</option>
                {campusBuildings().map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
            <div className="chips" aria-label="혼란 원인">
              {["", ...confusionReasons].map((value) => (
                <button key={value} className={reason === value ? "active" : ""}
                  aria-pressed={reason === value}
                  onClick={() => changeFilter(() => setReason(value))}>{value || "전체 원인"}</button>
              ))}
            </div>
          </div>
          {loading && <p role="status">통계를 불러오고 있어요.</p>}
          {loadError && <Notice>{loadError}</Notice>}
          <div className="stats-grid" aria-busy={loading}>
            {[
              ["지점 통과", `${insight.passages}건`, "세션·지점별 중복 제외"],
              [
                "혼란 신호",
                `${insight.confusions}건`,
                "피드백·위치 재확인 합집합",
              ],
              ["전체 혼란 비율", `${insight.rate}%`, "혼란 신호 ÷ 지점 통과"],
              [
                "개선 필요 지점",
                `${insight.points.filter((p) => p.level === "개선 필요").length}곳`,
                "통과 5회 이상 · 혼란율 30% 이상",
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
            <Tag>수준 · 비율순</Tag>
          </div>
          <p className="small">
            선택한 기간과 건물에서 지점별로 같은 세션을 한 번만 집계해요. 원인을 고르면 해당 원인의 혼란만 세어요.
          </p>
          {insight.points.length === 0 && (
            <Notice>
              선택한 조건에 해당하는 안내 기록이 없어요.
            </Notice>
          )}
          {insight.points.map((p, i) => (
            <div
              className={`card insight-point ${i === 0 ? "selected" : ""}`}
              key={p.id}
            >
              <div className="row insight-point-heading">
                <span className="rank">{i + 1}</span>
                <b>{p.name}</b>
                <Tag tone={levelTones[p.level]}>{p.level}</Tag>
              </div>
              <div className="between">
                <span className="small muted">
                  혼란 {p.confusions}건 / 통과 {p.passages}건
                </span>
                <strong className="blue-text">{p.rate}%</strong>
              </div>
              <progress value={p.rate} max={100} />
              {p.reasons.length > 0 && <div className="row insight-reasons">
                {p.reasons.slice(0, 2).map((r) => <Tag key={r.reason} tone="gray">{r.reason} {r.count}건</Tag>)}
              </div>}
              {(p.level === "개선 필요" || p.level === "주의") && p.topReason && (
                <p className="small">{improvementAdvice[p.topReason as ConfusionReason] ?? improvementAdvice.기타}</p>
              )}
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
                setInsight(await api<Insight>(insightPath));
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
