"use client";
import { useEffect, useRef, useState } from "react";
import { Lightbulb, ShieldCheck } from "lucide-react";
import { Notice, Tag } from "@/components/ui";
import { useCampus } from "@/features/navigation/campus-provider";
import { api, type Insight } from "@/features/navigation/campus-provider";
import { campusBuildings } from "@/shared/utils/campus3d/types";
import {
  confusionReasons,
  improvementAdvice,
  levelTones,
  type ConfusionLevel,
  type ConfusionReason,
} from "@/shared/utils/confusion-advice";
import { CampusOverviewMap, type HeatSpot, type RankSpot } from "@/features/navigation/campus-overview-map";
import { insightPointBuilding, insightPointPosition } from "@/shared/utils/insight-map";

type InsightPoint = Insight["points"][number];

// 수준 배지와 같은 색. 혼란율 막대와 지도 동그라미에도 씀
const levelColors: Record<ConfusionLevel, string> = {
  "개선 필요": "#d93b4a",
  "주의": "#e08a1e",
  "양호": "#2e9e5b",
  "기록 부족": "#9aa1ab",
};

const periods = [["today", "오늘"], ["7d", "최근 7일"], ["all", "전체"]] as const;

// 「오전 10:18」 꼴
const clock = (date: Date) => date.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });

export default function Screen() {
  const { busy, insight, setInsight, run, go } = useCampus();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [period, setPeriod] = useState("all");
  const [building, setBuilding] = useState("");
  const [reason, setReason] = useState("");
  const [excludeDemo, setExcludeDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  // 표·지도에서 고른 지점. 없으면 1순위
  const [selectedPoint, setSelectedPoint] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const detailRef = useRef<HTMLElement>(null);
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
        if (cancelled || revision !== authRevision.current) return;
        setInsight(value);
        setUpdatedAt(new Date());
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
  async function reload() {
    setInsight(await api<Insight>(insightPath));
    setUpdatedAt(new Date());
  }

  if (!insight)
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
        <form
          className="card stack admin-login-card"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              authRevision.current++;
              try {
                await api("admin/login", { id, password });
                await reload();
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
      </section>
    );

  const points = insight.points;
  const selectedIndex = Math.max(0, points.findIndex((p) => p.id === selectedPoint));
  const selected: InsightPoint | undefined = points[selectedIndex];
  const improvementCount = points.filter((p) => p.level === "개선 필요").length;
  // 좌표를 찾은 지점만 지도에 찍음(목록에는 모두 남김)
  const ranks: RankSpot[] = points.flatMap((p, i) => {
    const position = insightPointPosition(p.id);
    return position ? [{ id: p.id, position, rank: i + 1, label: p.name, color: levelColors[p.level] }] : [];
  });
  // 혼란 기록이 있는 지점만 열지도 원으로 보여 줌
  const heat: HeatSpot[] = points.flatMap((p) => {
    const position = p.confusions > 0 ? insightPointPosition(p.id) : undefined;
    return position
      ? [{ id: p.id, position, label: p.name, count: p.confusions, faded: p.level === "기록 부족" }]
      : [];
  });
  const kpis = [
    ["지점 통과", `${insight.passages}건`, "세션·지점별 중복 제외", false],
    ["혼란 신호", `${insight.confusions}건`, "피드백·위치 재확인 합집합", false],
    ["전체 혼란 비율", `${insight.rate}%`, "혼란 신호 ÷ 지점 통과", false],
    ["개선 필요 지점", `${improvementCount}곳`, "통과 5회 이상 · 혼란율 30% 이상", improvementCount > 0],
  ] as const;

  // 지도에서 고르면 상세가 화면 밖(모바일)일 수 있어 상세로 스크롤
  function showOnMap(pointId: string) {
    setSelectedPoint(pointId);
    detailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  return (
    <div className="admin-dashboard admin-screen">
      <header className="admin-topbar">
        <button type="button" className="admin-logo" onClick={() => go("home")} aria-label="CAMPASS 홈으로">
          CAMPASS
        </button>
        <span className="admin-topbar-divider" aria-hidden="true" />
        <h1 className="admin-topbar-title">관리자 인사이트</h1>
        <div className="admin-topbar-actions">
          {updatedAt && <span className="admin-updated">마지막 갱신 {clock(updatedAt)}</span>}
          <button
            type="button"
            className="admin-topbar-button"
            disabled={busy}
            onClick={() =>
              run(async () => {
                authRevision.current++;
                await reload();
              })
            }
          >
            새로고침
          </button>
          <button
            type="button"
            className="admin-topbar-button"
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
            로그아웃
          </button>
        </div>
      </header>

      <div className="admin-filterbar">
        <div className="admin-segment" role="group" aria-label="기간">
          {periods.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={period === value ? "active" : ""}
              aria-pressed={period === value}
              onClick={() => changeFilter(() => setPeriod(value))}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="admin-select">
          <select aria-label="건물" value={building} onChange={(e) => changeFilter(() => setBuilding(e.target.value))}>
            <option value="">전체 건물</option>
            {campusBuildings().map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <label className="admin-select">
          <select aria-label="혼란 원인" value={reason} onChange={(e) => changeFilter(() => setReason(e.target.value))}>
            {["", ...confusionReasons].map((value) => (
              <option key={value} value={value}>{value || "전체 원인"}</option>
            ))}
          </select>
        </label>
        {insight.demoSessions > 0 && (
          <label className="admin-switch">
            <input
              type="checkbox"
              role="switch"
              checked={excludeDemo}
              onChange={(e) => changeFilter(() => setExcludeDemo(e.target.checked))}
            />
            <span className="admin-switch-track" aria-hidden="true" />
            시연용 예시 빼고 보기
            <small>세션 {insight.demoSessions}개</small>
          </label>
        )}
      </div>
      {loading && <p className="small" role="status">통계를 불러오고 있어요.</p>}
      {loadError && <Notice>{loadError}</Notice>}

      <div className="admin-kpis" aria-busy={loading}>
        {kpis.map(([title, value, note, alert]) => (
          <div className={`admin-panel admin-kpi${alert ? " alert" : ""}`} key={title}>
            <small>{title}</small>
            <strong>{value}</strong>
            <small>{note}</small>
          </div>
        ))}
      </div>

      <div className="admin-body">
        <div className="admin-main">
          <section className="admin-panel admin-table-panel" aria-labelledby="admin-rank-title">
            <div className="between">
              <h2 id="admin-rank-title">혼란 지점 우선순위</h2>
              <Tag>수준 · 비율순</Tag>
            </div>
            {points.length === 0 ? (
              <Notice>선택한 조건에 해당하는 안내 기록이 없어요.</Notice>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">순위</th>
                    <th scope="col">지점</th>
                    <th scope="col" className="admin-col-optional">통과</th>
                    <th scope="col" className="admin-col-optional">혼란</th>
                    <th scope="col">혼란율</th>
                    <th scope="col" className="admin-col-optional">주요 원인</th>
                    <th scope="col">수준</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((p, i) => {
                    const on = i === selectedIndex;
                    const place = insightPointBuilding(p.id);
                    return (
                      <tr key={p.id} id={`insight-${p.id}`} className={on ? "selected" : ""} onClick={() => setSelectedPoint(p.id)}>
                        <td className="admin-rank">{i + 1}</td>
                        <td>
                          {/* 행 전체를 누를 수 있고, 키보드로는 이 버튼으로 고름 */}
                          <button type="button" className="admin-row-button" aria-pressed={on} onClick={() => setSelectedPoint(p.id)}>
                            <b>{p.name}</b>
                            {place && place !== p.name && <small>{place}</small>}
                          </button>
                        </td>
                        <td className="admin-col-optional">{p.passages}</td>
                        <td className="admin-col-optional">{p.confusions}</td>
                        <td>
                          <span className="admin-rate">
                            <span className="admin-bar" aria-hidden="true">
                              <i style={{ width: `${Math.min(p.rate, 100)}%`, background: levelColors[p.level] }} />
                            </span>
                            {p.rate}%
                          </span>
                        </td>
                        <td className="admin-col-optional">{p.topReason ?? "—"}</td>
                        <td><Tag tone={levelTones[p.level]}>{p.level}</Tag></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <p className="small muted">
              제출된 피드백 {insight.feedbacks}건 · 수동 도착 확인 기준 · 사람을 알아볼 수 있는 정보는 모으지 않아요
            </p>
          </section>

          <section className="admin-panel heat-map-card" aria-labelledby="heat-map-title">
            <h2 id="heat-map-title">헤맨 지점 지도</h2>
            {heat.length > 0 ? (
              <>
                <CampusOverviewMap heat={heat} selectedHeat={selected?.id} onHeat={showOnMap} height={300} />
                <div className="heat-legend" aria-hidden="true">
                  <span>적음</span>
                  <i />
                  <span>많음</span>
                  <em>흐린 원: 기록 부족(통과 5건 미만)</em>
                </div>
              </>
            ) : (
              <p className="small muted">지도에 표시할 혼란 기록이 없어요.</p>
            )}
          </section>
        </div>

        {selected && (
          <aside ref={detailRef} className="admin-panel admin-detail" aria-label="선택한 지점 상세">
            <div className="admin-detail-heading">
              <span className="admin-detail-rank">{selectedIndex + 1}순위</span>
              <h2>{selected.name}</h2>
              <Tag tone={levelTones[selected.level]}>{selected.level}</Tag>
            </div>
            <div className="admin-detail-stats">
              <div>
                <small>혼란율</small>
                <strong>{selected.rate}%</strong>
              </div>
              <div>
                <small>혼란 / 통과</small>
                <strong>{selected.confusions} / {selected.passages}</strong>
              </div>
            </div>
            <div className="admin-reasons">
              <h3>원인별</h3>
              {selected.reasons.length > 0 ? (
                selected.reasons.map((r) => (
                  <div className="admin-reason" key={r.reason}>
                    <span>{r.reason}</span>
                    <span className="admin-bar" aria-hidden="true">
                      <i style={{ width: `${(r.count / Math.max(...selected.reasons.map((x) => x.count))) * 100}%` }} />
                    </span>
                    <span>{r.count}건</span>
                  </div>
                ))
              ) : (
                <p className="small muted">기록된 원인이 없어요.</p>
              )}
            </div>
            {(selected.level === "개선 필요" || selected.level === "주의") && selected.topReason && (
              <div className="admin-advice">
                <Lightbulb size={18} aria-hidden="true" />
                <p>{improvementAdvice[selected.topReason as ConfusionReason] ?? improvementAdvice.기타}</p>
              </div>
            )}
            <div className="admin-detail-map">
              <CampusOverviewMap backgroundOnly ranks={ranks} selectedRank={selected.id} onRank={setSelectedPoint} height={260} />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
