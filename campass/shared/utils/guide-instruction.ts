import type { RouteOption, Waypoint } from "./routing.ts";
import { routeStepKind } from "./route-summary.ts";
import {
  buildingById,
  floorLabel,
  graphEdges,
  nodeArea,
  nodeLabel,
} from "./campus3d/route.ts";
import { areaName } from "./route-presentation.ts";

// 안내 문장을 단계 종류별 템플릿으로 만든다. 경로마다 따로 적지 않고 모든 경로에 똑같이 적용

export type GuideStepKind = "walk" | "hill" | "elevator" | "passage" | "stairs" | "entrance";

type Step = Pick<Waypoint, "node" | "link" | "name" | "instruction">;

// '○○으로' / '○○로'. 받침이 없거나 ㄹ 받침이면 '로'
export function toward(word: string) {
  const last = word.trim().at(-1) ?? "";
  if (/\d/.test(last)) return `${word}${/[036]/.test(last) ? "으로" : "로"}`;
  const code = last.charCodeAt(0) - 0xac00;
  const final = code >= 0 && code < 11172 ? code % 28 : 0;
  return `${word}${final === 0 || final === 8 ? "로" : "으로"}`;
}

const floorIndex = (node: string) => {
  const [id, floor] = node.split("|");
  return buildingById(id)?.floors.findIndex((f) => f.floor === floor) ?? -1;
};

export function guideStepKind(option: RouteOption, step: Step, next?: Step): GuideStepKind {
  const from = step.node;
  const to = next?.node;
  const kind = routeStepKind(option, step as Waypoint);
  // 실외 언덕길은 건물을 드나들어도 출입구가 아니라 오르막 단계로 봄(다른 단계와 합치지 않음)
  if (kind === "hill") return "hill";
  // 건물 밖 지점 ↔ 건물 층: 출입구로 드나듦
  if (from && to && from.includes("|") !== to.includes("|") &&
      (buildingById(nodeArea(from)) || buildingById(nodeArea(to))))
    return "entrance";
  if (kind === "elevator") return "elevator";
  if (kind === "stairs") return "stairs";
  if (kind === "indoor") return "passage";
  return "walk";
}

// 화면에 보여 줄 장소 이름. 「본관 5층↔한림관 3층 연결통로」는 지금 있는 건물 반대쪽만 남겨 「한림관 3층 연결통로」로
export function placeName(name: string, fromNode?: string) {
  if (!name.includes("↔")) return name;
  const sides = name.replace(/\s*연결통로$/, "").split("↔").map((side) => side.trim());
  const here = fromNode ? areaName(nodeArea(fromNode)) : "";
  const far = sides.find((side) => !here || !side.startsWith(here)) ?? sides.at(-1);
  return `${far} 연결통로`;
}

// '○○을' / '○○를'
const object = (word: string) => {
  const code = (word.trim().at(-1) ?? "").charCodeAt(0) - 0xac00;
  return `${word}${code >= 0 && code < 11172 && code % 28 !== 0 ? "을" : "를"}`;
};

// 화면에 보여 주는 안내 단계. 서버 단계 first~last를 하나로 묶고, 끝나면 steps[last + 1]에 도착
export type GuideStepGroup = { first: number; last: number; instruction: string };

// 서버 단계를 안내 단계로 묶는다. 경로마다 따로 적지 않고 모든 경로에 같은 규칙을 씀
// - 복도 → 같은 건물 엘리베이터 앞: 「{건물} 엘리베이터 앞으로 걸어가세요」 한 단계
// - 같은 건물 출입구로 들어갔다 바로 나감: 「{건물}을 지나 반대편 출입구로 나가세요」 한 단계
// - 바로 앞 단계와 문장이 같음: 「통로를 따라 {다음 장소}까지 걸어가세요」
export function guideStepGroups(
  option: RouteOption | undefined,
  steps: Step[],
  destinationName: string,
): GuideStepGroup[] {
  const sentences = steps.map((step, i) => stepInstruction(option, step, steps[i + 1], destinationName));
  const groups: GuideStepGroup[] = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i], next = steps[i + 1], after = steps[i + 2];
    const building = step.node ? areaName(nodeArea(step.node)) : "";
    const walkInside = (a?: Step, b?: Step) => Boolean(a?.node && b?.node && a.node.includes("|") &&
      nodeArea(a.node) === nodeArea(b.node) && floorIndex(a.node) === floorIndex(b.node));
    if (option && next && after && walkInside(step, next) && walkInside(next, after) &&
        /엘리베이터/.test(after.name) && !/엘리베이터/.test(next.name)) {
      groups.push({ first: i, last: i + 1, instruction: `${building} 엘리베이터 앞으로 걸어가세요` });
      i++;
      continue;
    }
    if (option && next && after && step.node && next.node && after.node &&
        !step.node.includes("|") && next.node.includes("|") && !after.node.includes("|") &&
        guideStepKind(option, step, next) === "entrance" && guideStepKind(option, next, after) === "entrance") {
      groups.push({ first: i, last: i + 1, instruction: `${object(areaName(nodeArea(next.node)))} 지나 반대편 출입구로 나가세요` });
      i++;
      continue;
    }
    const previous = groups.at(-1);
    const hill = Boolean(option && next && guideStepKind(option, step, next) === "hill");
    groups.push({
      first: i,
      last: i,
      instruction: !hill && next && previous && previous.instruction === sentences[i]
        ? `통로를 따라 ${placeName(next.name, step.node)}까지 걸어가세요`
        : sentences[i],
    });
  }
  return groups;
}

// 서버 단계 번호가 속한 안내 단계
export function groupIndexOf(groups: GuideStepGroup[], step: number) {
  return Math.max(0, groups.findIndex((g) => step >= g.first && step <= g.last));
}

// 지금 할 일을 동작으로 말하는 한 줄. 예: 「본관 엘리베이터를 타고 5층으로 올라가세요」
export function guideInstruction(
  option: RouteOption | undefined,
  step: Step,
  next: Step | undefined,
  destinationName: string,
) {
  return stepInstruction(option, step, next, destinationName);
}

function stepInstruction(
  option: RouteOption | undefined,
  step: Step,
  next: Step | undefined,
  destinationName: string,
) {
  if (!next) return `${destinationName}에 도착했어요`;
  // 연결통로 위(사진 안내 지점)에서는 통로를 따라 다음 지점으로
  if (!step.node && step.link) return `연결통로를 따라 ${toward(next.name)} 걸어가세요`;
  if (!option || !step.node || !next.node) return step.instruction;
  const from = step.node;
  const to = next.node;
  const kind = guideStepKind(option, step, next);
  const building = buildingById(nodeArea(from)) ?? buildingById(nodeArea(to));
  const up = floorIndex(to) > floorIndex(from);
  const nextName = next.name || nodeLabel(to);
  // 같은 층 안에서 다음 지점(엘리베이터 앞 등)으로 가는 단계는 걷기
  const sameFloor = from === to || (nodeArea(from) === nodeArea(to) && floorIndex(from) === floorIndex(to));
  if (sameFloor)
    // 「A↔B 연결통로」 앞으로 갈 때는 기호 없이 가는 쪽 이름만 씀
    return nextName.includes("↔")
      ? `${placeName(nextName, from)}로 걸어가세요`
      : `${toward(nextName)} 걸어가세요`;
  switch (kind) {
    case "elevator":
      return `${building?.name ?? ""} 엘리베이터를 타고 ${toward(floorLabel(to))} ${up ? "올라가세요" : "내려가세요"}`.trim();
    case "stairs":
      return nodeArea(from) === nodeArea(to) && building
        ? `${building.name} 계단으로 ${floorLabel(to)}까지 ${up ? "올라가세요" : "내려가세요"}`
        : `계단을 따라 ${toward(nextName)} 이동하세요`;
    case "passage":
      // 건물이 바뀌는 연결 구간은 들어갈 건물·층을 말함. 예: 「본관 2층으로 이어진 길로 걸어가세요」
      return nodeArea(from) !== nodeArea(to) && buildingById(nodeArea(to))
        ? `${toward(`${areaName(nodeArea(to))} ${floorLabel(to)}`)} 이어진 길로 걸어가세요`
        : `${nodeLabel(from)} 연결통로로 걸어가세요`;
    case "entrance":
      return from.includes("|")
        ? `${areaName(nodeArea(from))} 출입구로 나가세요`
        : `${areaName(nodeArea(to))} 출입구로 들어가세요`;
    case "hill":
      return `오르막길을 따라 ${toward(nextName)} 걸어가세요`;
    default:
      return `${toward(nextName)} 걸어가세요`;
  }
}

// 지금 단계 구간이 현장 확인을 마치지 않았는지('확인'이 아닌 연결). 확인된 구간이면 안내 표지 문구를 숨김
export function stepUnverified(option: RouteOption | undefined, step: Pick<Waypoint, "node" | "link">) {
  if (!option) return false;
  const index = step.node ? option.nodes.indexOf(step.node) : -1;
  const linkId = step.link ?? (index >= 0 ? option.links[index] : undefined);
  const edge = linkId ? graphEdges.find((e) => e.id === linkId) : undefined;
  return Boolean(edge && edge.status !== "확인");
}

// 경로 상세 시트 단계 목록의 항목. 안내 중 화면의 안내 단계(묶음)와 같은 단위
export type GuideStepItem = {
  title: string;
  instruction: string;
  kind: GuideStepKind | "start" | "destination";
  // 주요 지점: 출발, 엘리베이터 타는 곳, 오르막, 다른 건물로 넘어가는 곳, 도착
  major: boolean;
  // 주요 지점이 많을 때 남길 순서. 출발 0 > 도착 1 > 엘리베이터·오르막 2 > 연결통로 3
  priority: number;
};

export function guideStepItems(
  option: RouteOption,
  steps: Step[],
  destinationName: string,
): GuideStepItem[] {
  const groups = guideStepGroups(option, steps, destinationName);
  return groups.map((group, index) => {
    const step = steps[group.first];
    const target = steps[group.last + 1];
    if (index === 0)
      return { title: step.name, instruction: group.instruction, kind: "start", major: true, priority: 0 };
    // 마지막은 건물이 아니라 실제 도착지 이름(예: 혜인관 2층 면접 대기실)
    if (!target)
      return { title: step.name || destinationName, instruction: "도착했어요", kind: "destination", major: true, priority: 1 };
    const from = steps[group.last].node;
    const to = target.node;
    const kind = guideStepKind(option, steps[group.last], target);
    // 엘리베이터 타는 곳: 실제로 층이 바뀔 때만
    if (kind === "elevator" && from && to && floorIndex(from) !== floorIndex(to))
      return {
        title: `${areaName(nodeArea(from))} 엘리베이터 → ${floorLabel(to)}`,
        instruction: group.instruction,
        kind,
        major: true,
        priority: 2,
      };
    // 오르막(실외 언덕) 구간은 항상 주요 지점
    if (kind === "hill")
      return { title: `${placeName(target.name, from)}까지 오르막길`, instruction: group.instruction, kind, major: true, priority: 2 };
    // 다른 건물로 넘어가는 곳: 연결통로로 건물이 바뀔 때
    if (kind === "passage" && from && to && nodeArea(from) !== nodeArea(to) && buildingById(nodeArea(to)))
      return {
        title: `${areaName(nodeArea(to))} ${floorLabel(to)} 연결통로`,
        instruction: group.instruction,
        kind,
        major: true,
        priority: 3,
      };
    // 그 밖의 단계는 단계를 시작하는 곳 이름(도착지 이름과 겹치지 않게)
    return {
      title: placeName(step.name, steps[group.first - 1]?.node),
      instruction: group.instruction,
      kind,
      major: false,
      priority: 4,
    };
  });
}

// 단계 목록에서 접지 않고 보여 줄 항목. 5개 이하면 전부.
// 넘치면 주요 지점을 우선순위대로 최대 5곳만 남기고(같은 순위는 뒤쪽부터 숨김), 숨길 게 1개뿐이면 접지 않음
export function visibleStepItems(items: GuideStepItem[], limit = 5): boolean[] {
  if (items.length <= limit) return items.map(() => true);
  const keep = new Set(
    items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.major)
      .sort((a, b) => a.item.priority - b.item.priority || a.index - b.index)
      .slice(0, limit)
      .map(({ index }) => index),
  );
  const hidden = items.length - keep.size;
  return items.map((_, index) => hidden <= 1 || keep.has(index));
}
