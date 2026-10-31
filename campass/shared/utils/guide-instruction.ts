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
  // 건물 밖 지점 ↔ 건물 층: 출입구로 드나듦
  if (from && to && from.includes("|") !== to.includes("|") &&
      (buildingById(nodeArea(from)) || buildingById(nodeArea(to))))
    return "entrance";
  const kind = routeStepKind(option, step as Waypoint);
  if (kind === "elevator") return "elevator";
  if (kind === "stairs") return "stairs";
  if (kind === "indoor") return "passage";
  if (kind === "hill") return "hill";
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
    groups.push({
      first: i,
      last: i,
      instruction: next && previous && previous.instruction === sentences[i]
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
