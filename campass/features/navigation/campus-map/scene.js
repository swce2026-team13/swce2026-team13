import {
  campusMap,
  routeSegments,
  MAP_MARKERS,
  markerCoordinate,
  getFloorElevations,
  toScenePosition,
  terrainDisc,
  terrainHeight,
  buildingGround,
  undergroundFloors,
  MAP_HEIGHT_SCALE,
  PLAZA_ELEVATION,
} from "../../../shared/utils/campus-map.ts";
import styles from "../../../styles/campus-map.module.css";
import { mapEntrances, layoutEntrancePins } from "../map-entrances.ts";

/**
 * 팀의 건물 윤곽을 그려요. 경로 계산은 기존 그래프에 맡겨요.
 * @param {*} THREE 지도 렌더링 모듈
 * @param {HTMLDivElement} container
 * @param {{ onSelect: (selection: import('../../../shared/utils/campus-map.ts').MapSelection | null) => void,
 *   onError: () => void, interactive?: boolean, onMarker?: (id: string) => void }} events
 * @returns {import('../../../shared/utils/campus-map.ts').CampusMapController}
 */
export function createCampusScene(THREE, container, events) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  // 해와 건물은 움직이지 않으므로 그림자 지도는 처음 한 번만 그린다(회전·확대 때 다시 그리지 않음).
  // 휴대폰(터치 화면)은 화소마다 한 번만 확인하는 가벼운 그림자, 데스크톱은 부드러운 그림자.
  const touch = window.matchMedia("(pointer: coarse)").matches;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = touch ? THREE.BasicShadowMap : THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const canvas = renderer.domElement;
  canvas.setAttribute(
    "aria-label",
    "서경대학교 3D 캠퍼스 지도. 건물 선택 메뉴로도 탐색할 수 있어요.",
  );
  canvas.setAttribute("role", "img");
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#dfe7f1");
  scene.fog = new THREE.Fog("#dfe7f1", 900, 2600);
  const camera = new THREE.PerspectiveCamera(36, 1, 1, 5000);
  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = !window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  controls.dampingFactor = 0.09;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.minDistance = 45;
  controls.maxDistance = 2400;
  controls.screenSpacePanning = true;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa6b8, 0.72));
  // 햇빛 0.85를 그림자를 만드는 빛(0.5)과 만들지 않는 빛(0.35)으로 나눠
  // 그림자 속도 햇빛 일부를 받게 한다 → 그림자가 연해진다.
  // 해를 높이 두어(남서쪽 위) 그림자를 짧게 한다.
  const SUN_DIRECTION = new THREE.Vector3(-0.32, 1, 0.42).normalize();
  const sunColor = new THREE.Color("#fff4e2");
  const light = new THREE.DirectionalLight(sunColor, 0.5);
  light.castShadow = true;
  const shadowSize = touch ? 1024 : 2048;
  light.shadow.mapSize.set(shadowSize, shadowSize);
  light.shadow.bias = -0.0006;
  light.shadow.normalBias = 0.4;
  const fill = new THREE.DirectionalLight(sunColor, 0.35);
  fill.position.copy(SUN_DIRECTION);
  scene.add(light, light.target, fill);
  const world = new THREE.Group();
  scene.add(world);
  const routeLayer = new THREE.Group();
  world.add(routeLayer);
  const labelLayer = document.createElement("div");
  labelLayer.className = styles.labels;
  labelLayer.setAttribute("aria-hidden", "true");
  // 안내 중 내 위치 점. 화면 위에 겹친 HTML이라 건물에 가려지지 않고, 맥박 효과는 CSS로 돈다.
  const me = document.createElement("div");
  me.className = styles.me;
  me.hidden = true;
  labelLayer.appendChild(me);
  let mePosition = null;
  const compass = document.createElement("div");
  compass.className = styles.north;
  compass.setAttribute("aria-hidden", "true");
  compass.innerHTML = "<span>↑</span><b>N</b>";
  const bounds = new THREE.Box3();
  const buildingBounds = new Map();
  const floors = [];
  const labels = [];
  const markers = [];
  let selectedId = null;
  let routeIds = [];
  let routeNodes = [];
  let currentId;
  let plazaMesh;
  let frame = 0;
  let disposed = false;
  let observer;

  // 건물 재질: 평소에는 불투명한 콘크리트 벽 + 창문 띠, 지붕은 회색.
  // 고르거나 경로에 든 건물만 층마다 가진 반투명 강조 재질로 바꿔 끼운다.
  const WALL_COLOR = "#e9e5dc";
  const WINDOW_REPEAT_M = 6;
  function windowTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    g.fillStyle = WALL_COLOR;
    g.fillRect(0, 0, 64, 64);
    // 한 층(세로 64px) 안의 창문 띠와 창틀
    g.fillStyle = "#8d9aab";
    g.fillRect(0, 20, 64, 26);
    g.fillStyle = "#a9b5c4";
    g.fillRect(0, 20, 64, 5);
    g.fillStyle = WALL_COLOR;
    for (let x = 0; x < 64; x += 16) g.fillRect(x, 20, 3, 26);
    const texture = new THREE.CanvasTexture(c);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    return texture;
  }
  const wallTexture = windowTexture();
  // 하늘빛 0.72 + 햇빛 0.85가 위를 보는 면을 약 1.47배 밝게 하므로,
  // 지붕·바닥은 그만큼 어둡게 넣어 화면에서 목표 색(#b9bfc9, #cfd8c4)으로 보이게 한다.
  const UP_LIGHT = 0.72 + 0.85 * SUN_DIRECTION.y;
  const litAs = (hex) => new THREE.Color(hex).multiplyScalar(1 / UP_LIGHT);
  const roofMaterial = new THREE.MeshLambertMaterial({ color: litAs("#b9bfc9") });
  const wallMaterial = new THREE.MeshLambertMaterial({ color: "#ffffff", map: wallTexture });
  const baseMaterials = [roofMaterial, wallMaterial];
  const plinthMaterial = new THREE.MeshLambertMaterial({ color: "#d6d1c6" });
  // 지하층: 면 없이 점선 테두리만. 땅을 뚫고 보이도록 깊이 검사 없이 지형 다음·건물 전에 그린다.
  const dashedMaterials = new Map();
  function dashed(color) {
    if (!dashedMaterials.has(color))
      dashedMaterials.set(
        color,
        new THREE.LineDashedMaterial({
          color,
          dashSize: 1.6,
          gapSize: 1.1,
          depthTest: false,
          depthWrite: false,
          fog: false,
        }),
      );
    return dashedMaterials.get(color);
  }
  const UNDERGROUND_COLOR = "#6b7280";
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: "#8b8f98",
    transparent: true,
    opacity: 0.22,
  });
  // 벽(그룹 1)의 UV를 가로 6m · 세로 한 층마다 창문 무늬가 한 번 반복되게 맞춘다.
  function fitWallUv(geometry, depth) {
    const uv = geometry.attributes.uv;
    const position = geometry.attributes.position;
    for (const group of geometry.groups) {
      if (group.materialIndex !== 1) continue;
      for (let i = group.start; i < group.start + group.count; i++)
        uv.setXY(i, uv.getX(i) / WINDOW_REPEAT_M, position.getZ(i) / depth);
    }
    uv.needsUpdate = true;
  }

  const point = (east, north, elevation) =>
    new THREE.Vector3(...toScenePosition({ east, north, elevation }));
  const entrances = events.showEntrances ? mapEntrances.map((pin) => ({
    id: pin.id,
    position: point(pin.coordinate.east, pin.coordinate.north, pin.coordinate.elevation + 1),
  })) : [];
  function shape(polygon) {
    const result = new THREE.Shape();
    // 원본 상승관 윤곽에서 연속으로 반복되는 점을 제외해요.
    polygon
      .filter(
        (p, i) =>
          i === 0 || p[0] !== polygon[i - 1][0] || p[1] !== polygon[i - 1][1],
      )
      .forEach((p, i) =>
        i ? result.lineTo(p[0], p[1]) : result.moveTo(p[0], p[1]),
      );
    return result;
  }
  function addLabel(text, position, buildingId, kind) {
    const element = document.createElement("span");
    element.className = kind ? `${styles.label} ${styles.markerLabel}` : styles.label;
    if (kind) element.dataset.kind = kind;
    // 지점 이름표는 작은 핀보다 누르기 쉬우므로 이름표 자체도 출발 선택 버튼으로 쓴다.
    if (kind && events.interactive && events.onMarker) {
      element.dataset.tap = "true";
      element.addEventListener("click", () => events.onMarker(buildingId));
    }
    element.textContent = text;
    labelLayer.appendChild(element);
    labels.push({ element, position, buildingId, marker: Boolean(kind) });
  }
  // 정류장·정문·주차장 표시는 출발로 고르거나 경로에 들어 있으면 강조한다.
  function markerActive(marker) {
    return (
      routeIds.includes(marker.id) ||
      routeNodes.includes(marker.id) ||
      routeNodes.includes(marker.routeId)
    );
  }
  function labelSelected(label) {
    const focus = currentId ?? selectedId;
    if (label.marker) {
      const marker = markers.find((m) => m.id === label.buildingId);
      return Boolean(marker && markerActive(marker));
    }
    return Boolean(focus && label.buildingId === focus);
  }
  function scheduleRender() {
    if (!disposed && !frame) frame = window.requestAnimationFrame(render);
  }
  function render() {
    frame = 0;
    if (disposed) return;
    controls.update();
    renderer.render(scene, camera);
    compass.firstElementChild.style.transform = `rotate(${controls.getAzimuthalAngle()}rad)`;
    const occupied = [];
    const width = container.clientWidth;
    const height = container.clientHeight;
    me.hidden = true;
    if (mePosition) {
      const projected = mePosition.clone().project(camera);
      const x = ((projected.x + 1) * width) / 2;
      const y = ((1 - projected.y) * height) / 2;
      if (projected.z >= -1 && projected.z <= 1 && x >= 0 && x <= width && y >= 0 && y <= height) {
        me.hidden = false;
        // 점은 이름표보다 위(z-index)에 그려져 가려지지 않으므로 이름표 자리는 막지 않는다.
        me.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      }
    }
    // 작은 화면에서는 현재 건물·고른 지점 이름을 우선하고, 다음으로 출발 지점 이름을 남겨요.
    const ordered = [...labels].sort(
      (a, b) =>
        Number(labelSelected(b)) - Number(labelSelected(a)) ||
        Number(b.marker) - Number(a.marker) ||
        a.position.distanceToSquared(camera.position) -
          b.position.distanceToSquared(camera.position),
    );
    for (const label of ordered) {
      const projected = label.position.clone().project(camera);
      label.element.hidden = false;
      const w = label.element.offsetWidth;
      const h = label.element.offsetHeight;
      const x = ((projected.x + 1) * width) / 2;
      const y = ((1 - projected.y) * height) / 2;
      const box = { left: x - w / 2, right: x + w / 2, top: y - h, bottom: y };
      const hidden =
        projected.z < -1 ||
        projected.z > 1 ||
        box.left < 2 ||
        box.right > width - 2 ||
        box.top < 48 ||
        box.bottom > height - 3 ||
        occupied.some(
          (r) =>
            box.left < r.right + 3 &&
            box.right > r.left - 3 &&
            box.top < r.bottom + 3 &&
            box.bottom > r.top - 3,
        );
      label.element.hidden = hidden;
      label.element.dataset.selected = String(labelSelected(label));
      if (!hidden) {
        label.element.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
        occupied.push(box);
      }
    }
    if (events.showEntrances) {
      const projectedPins = entrances.map((pin) => {
        const p = pin.position.clone().project(camera);
        return { id: pin.id, x: (p.x + 1) * width / 2, y: (1 - p.y) * height / 2,
          visible: p.z >= -1 && p.z <= 1 };
      });
      events.onEntrances?.(layoutEntrancePins(projectedPins, width, height, occupied));
    }
  }
  function fitBox(box) {
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const vertical = THREE.MathUtils.degToRad(camera.fov);
    const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * camera.aspect);
    const distance = Math.min(
      controls.maxDistance,
      Math.max(
        controls.minDistance,
        (sphere.radius / Math.sin(Math.min(vertical, horizontal) / 2)) * 1.13,
      ),
    );
    // 전체 보기로 돌아갈 때 남아 있는 회전 관성을 정리해요.
    const damping = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();
    controls.target.copy(sphere.center);
    camera.position
      .copy(sphere.center)
      .add(
        new THREE.Vector3(0, 0.82, 0.58).normalize().multiplyScalar(distance),
      );
    controls.update();
    controls.enableDamping = damping;
    scheduleRender();
  }
  function highlight() {
    for (const floor of floors) {
      const id = floor.mesh.userData.buildingId;
      const role = routeIds.indexOf(id);
      const active = id === (currentId ?? selectedId);
      const on = role >= 0 || active;
      const color = !events.interactive && active
        ? "#1747b5"
        : role === 0
          ? "#2563eb"
          : events.interactive && role === 1
            ? "#ef4444"
            : "#5c8cf1";
      // 지하층은 면을 그리지 않고 점선 색만 바꾼다.
      if (floor.underground) {
        floor.edge.material = dashed(on ? color : UNDERGROUND_COLOR);
        continue;
      }
      floor.mesh.material = on ? floor.highlight : baseMaterials;
      floor.mesh.renderOrder = on ? 1 : 0;
      if (on) floor.highlight.color.set(color);
    }
    for (const marker of markers) {
      const on = markerActive(marker);
      marker.head.scale.setScalar(on ? 1.35 : 1);
      marker.head.position.y = marker.top + (on ? 1 : 0);
      marker.ring.material.color.set(on ? "#2563eb" : "#ffffff");
      marker.ring.material.opacity = on ? 0.9 : 0.75;
      marker.ring.scale.setScalar(on ? 1.5 : 1);
    }
    if (plazaMesh) {
      plazaMesh.material.color.set(
        currentId === "스콘스퀘어"
          ? "#1747b5"
          : routeIds.includes("스콘스퀘어")
            ? "#5c8cf1"
            : "#e7d6ae",
      );
    }
    scheduleRender();
  }
  function showRoute(nodes) {
    routeNodes = nodes;
    for (const child of [...routeLayer.children]) {
      child.geometry.dispose();
      child.material.dispose();
      routeLayer.remove(child);
    }
    const joints = new Map();
    for (const [from, to] of routeSegments(nodes)) {
      const a = point(from.east, from.north, from.elevation + 1.2);
      const b = point(to.east, to.north, to.elevation + 1.2);
      const delta = b.clone().sub(a);
      if (delta.length() < 0.01) continue;
      for (const endpoint of [a, b]) joints.set(endpoint.toArray().join(","), endpoint);
      // 흰 외곽선과 굵은 빨간 선을 건물 위에 겹쳐 실내 구간도 보이게 한다.
      for (const [radius, color, order] of [
        [1.5, "#ffffff", 5],
        [0.95, "#dc2626", 6],
      ]) {
        const mesh = new THREE.Mesh(
          new THREE.CylinderGeometry(radius, radius, delta.length(), 16),
          new THREE.MeshBasicMaterial({
            color,
            depthTest: false,
            depthWrite: false,
            transparent: true,
            fog: false,
          }),
        );
        mesh.position.copy(a).add(b).multiplyScalar(0.5);
        mesh.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          delta.clone().normalize(),
        );
        mesh.renderOrder = order;
        routeLayer.add(mesh);
      }
    }
    // 끝점과 공유 꼭짓점을 구로 마감해 원통 사이의 틈과 각진 단면을 없앤다.
    for (const position of joints.values()) {
      for (const [radius, color, order] of [
        [1.5, "#ffffff", 5],
        [0.95, "#dc2626", 6],
      ]) {
        const cap = new THREE.Mesh(
          new THREE.SphereGeometry(radius, 16, 12),
          new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false, transparent: true, fog: false }),
        );
        cap.position.copy(position);
        cap.renderOrder = order;
        routeLayer.add(cap);
      }
    }
    highlight();
  }
  function select(selection) {
    selectedId = selection?.buildingId ?? null;
    highlight();
    events.onSelect(selection);
  }
  function fitAll() {
    select(null);
    fitBox(bounds);
  }
  function resize() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (disposed || !width || !height) return;
    // 스타일 적용 전에도 화면 크기를 유지해요.
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    fitBox(selectedId ? buildingBounds.get(selectedId) : bounds);
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const pointers = new Set();
  let down = null;
  function pointerDown(event) {
    if (!events.interactive) return;
    pointers.add(event.pointerId);
    down =
      pointers.size === 1 && event.button === 0
        ? { id: event.pointerId, x: event.clientX, y: event.clientY }
        : null;
  }
  function pointerMove(event) {
    if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6)
      down = null;
  }
  function pointerUp(event) {
    pointers.delete(event.pointerId);
    const start = down;
    down = null;
    if (
      !start ||
      start.id !== event.pointerId ||
      pointers.size ||
      Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6
    )
      return;
    const rect = canvas.getBoundingClientRect();
    if (
      !rect.width ||
      !rect.height ||
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      return;
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    // 지점 표시는 작으므로 넉넉한 투명 영역을 먼저 확인해요.
    const marker = raycaster.intersectObjects(markers.map((m) => m.hit))[0];
    if (marker && events.onMarker) {
      events.onMarker(marker.object.userData.markerId);
      return;
    }
    const hit = raycaster.intersectObjects(
      floors.map((floor) => floor.mesh),
    )[0];
    select(hit ? { buildingId: hit.object.userData.buildingId } : null);
  }
  function pointerCancel(event) {
    pointers.delete(event.pointerId);
    down = null;
  }
  function contextLost(event) {
    event.preventDefault();
    events.onError();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    window.cancelAnimationFrame(frame);
    observer?.disconnect();
    controls.removeEventListener("change", scheduleRender);
    controls.dispose();
    canvas.removeEventListener("pointerdown", pointerDown);
    canvas.ownerDocument.removeEventListener("pointermove", pointerMove);
    canvas.ownerDocument.removeEventListener("pointerup", pointerUp);
    canvas.ownerDocument.removeEventListener("pointercancel", pointerCancel);
    canvas.removeEventListener("lostpointercapture", pointerCancel);
    canvas.removeEventListener("webglcontextlost", contextLost);
    world.traverse((object) => {
      object.geometry?.dispose();
      if (object.material) {
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    for (const floor of floors) floor.highlight.dispose();
    for (const material of dashedMaterials.values()) material.dispose();
    wallTexture.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
    labelLayer.remove();
    compass.remove();
  }

  try {
    const inDisc = (p) => {
      const d = terrainDisc();
      return Math.hypot(p[0] - d.center[0], p[1] - d.center[1]) <= d.radius;
    };
    for (const contour of campusMap.contours) {
      // 등고선은 지형 표면에 얹고(다듬은 지형과 높이가 조금 달라 묻히지 않게), 판 밖은 자른다.
      const runs = [[]];
      for (const p of contour.p) {
        if (inDisc(p)) runs.at(-1).push(point(p[0], p[1], terrainHeight(p[0], p[1]) + 0.5));
        else if (runs.at(-1).length) runs.push([]);
      }
      for (const run of runs) {
        if (run.length < 2) continue;
        world.add(
          new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(run),
            new THREE.LineBasicMaterial({
              color: "#b39a74",
              transparent: true,
              opacity: contour.m ? 0.35 : 0.14,
            }),
          ),
        );
      }
    }
    // 바닥: 등고선으로 만든 지형을 둥근 판(디오라마)으로. 가장자리는 지형을 따라 8m 두께로 잘라
    // 흙색 옆면을 붙인다. 판 밖은 배경이 보인다.
    const disc = terrainDisc();
    const groundMaterial = new THREE.MeshLambertMaterial({
      color: litAs("#cfd8c4"),
      // 등고선·광장이 지형과 겹쳐 깜빡이지 않게 지형을 살짝 뒤로 민다.
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    const RING_STEP = 6;
    const SEGMENTS = 112;
    const rings = Math.ceil(disc.radius / RING_STEP);
    const surface = [];
    const at = (radius, angle) => {
      const east = disc.center[0] + Math.cos(angle) * radius;
      const north = disc.center[1] + Math.sin(angle) * radius;
      return point(east, north, terrainHeight(east, north));
    };
    surface.push(...at(0, 0).toArray());
    for (let ring = 1; ring <= rings; ring++)
      for (let k = 0; k < SEGMENTS; k++)
        surface.push(...at(Math.min(disc.radius, ring * RING_STEP), (k / SEGMENTS) * Math.PI * 2).toArray());
    const index = (ring, k) => (ring ? 1 + (ring - 1) * SEGMENTS + (k % SEGMENTS) : 0);
    const faces = [];
    for (let k = 0; k < SEGMENTS; k++) faces.push(0, index(1, k), index(1, k + 1));
    for (let ring = 1; ring < rings; ring++)
      for (let k = 0; k < SEGMENTS; k++) {
        const a = index(ring, k);
        const b = index(ring, k + 1);
        const c = index(ring + 1, k);
        const d = index(ring + 1, k + 1);
        faces.push(a, c, b, b, c, d);
      }
    const groundGeometry = new THREE.BufferGeometry();
    groundGeometry.setAttribute("position", new THREE.Float32BufferAttribute(surface, 3));
    groundGeometry.setIndex(faces);
    groundGeometry.computeVertexNormals();
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.renderOrder = -2;
    ground.receiveShadow = true;
    // 옆면: 가장 바깥 고리에서 8m 아래까지
    const wall = [];
    const wallFaces = [];
    for (let k = 0; k <= SEGMENTS; k++) {
      const top = at(disc.radius, (k / SEGMENTS) * Math.PI * 2);
      wall.push(...top.toArray(), top.x, top.y - 8 * MAP_HEIGHT_SCALE, top.z);
      if (k < SEGMENTS) {
        const a = k * 2;
        wallFaces.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
      }
    }
    const wallGeometry = new THREE.BufferGeometry();
    wallGeometry.setAttribute("position", new THREE.Float32BufferAttribute(wall, 3));
    wallGeometry.setIndex(wallFaces);
    wallGeometry.computeVertexNormals();
    const side = new THREE.Mesh(
      wallGeometry,
      new THREE.MeshLambertMaterial({ color: "#c2b8a3", side: THREE.DoubleSide }),
    );
    side.renderOrder = -2;
    world.add(ground, side);
    const plazaGeometry = new THREE.ShapeGeometry(
      shape(campusMap.plaza.polygon),
    );
    plazaGeometry.rotateX(-Math.PI / 2);
    const plaza = new THREE.Mesh(
      plazaGeometry,
      new THREE.MeshLambertMaterial({
        color: "#e7d6ae",
        side: THREE.DoubleSide,
      }),
    );
    plaza.position.y = point(0, 0, PLAZA_ELEVATION).y;
    plaza.receiveShadow = true;
    world.add(plaza);
    plazaMesh = plaza;
    addLabel(
      "스콘스퀘어",
      point(...campusMap.plaza.center, PLAZA_ELEVATION + 2),
      "스콘스퀘어",
    );

    for (const building of campusMap.buildings) {
      const elevations = getFloorElevations(building);
      const roof = elevations[elevations.length - 1] + 4;
      const box = new THREE.Box3();
      for (const p of building.poly) {
        box.expandByPoint(point(p[0], p[1], elevations[0]));
        box.expandByPoint(point(p[0], p[1], roof));
      }
      buildingBounds.set(building.id, box);
      bounds.union(box);
      // 받침: 건물 바닥에서 건물 둘레의 가장 낮은 땅까지. 벽 아래쪽과 비슷한 색으로 덜 튀게 한다.
      const baseY = point(0, 0, elevations[0]).y;
      const groundY = point(0, 0, buildingGround(building)).y;
      if (baseY - groundY > 0.3) {
        const plinthGeometry = new THREE.ExtrudeGeometry(shape(building.poly), {
          depth: baseY - groundY,
          bevelEnabled: false,
        });
        plinthGeometry.rotateX(-Math.PI / 2);
        const plinth = new THREE.Mesh(plinthGeometry, plinthMaterial);
        plinth.position.y = groundY;
        plinth.castShadow = plinth.receiveShadow = true;
        world.add(plinth);
      }
      const underground = undergroundFloors(building);
      building.floors.forEach((floor, i) => {
        const top = elevations[i + 1] ?? roof;
        const depth = Math.max(0.6, (top - elevations[i]) * MAP_HEIGHT_SCALE);
        const geometry = new THREE.ExtrudeGeometry(shape(building.poly), {
          depth,
          bevelEnabled: false,
        });
        fitWallUv(geometry, depth);
        geometry.rotateX(-Math.PI / 2);
        const opacity = building.approx ? 0.3 : floor.passOnly ? 0.45 : 0.82;
        const highlightMaterial = new THREE.MeshLambertMaterial({
          color: "#d3def7",
          transparent: true,
          opacity: 0.95,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(geometry, baseMaterials);
        mesh.position.y = point(0, 0, elevations[i]).y;
        mesh.userData = { buildingId: building.id, floor: floor.floor };
        mesh.castShadow = mesh.receiveShadow = true;
        const edge = new THREE.LineSegments(
          new THREE.EdgesGeometry(geometry, 25),
          underground[i] ? dashed(UNDERGROUND_COLOR) : edgeMaterial,
        );
        edge.position.copy(mesh.position);
        if (underground[i]) {
          // 지하층은 면을 숨기고(누르기 판정은 그대로) 점선 테두리만 남긴다.
          mesh.visible = false;
          edge.computeLineDistances();
          edge.renderOrder = -1;
        }
        world.add(mesh, edge);
        floors.push({
          mesh,
          edge,
          opacity,
          highlight: highlightMaterial,
          underground: underground[i],
        });
      });
      addLabel(building.name, point(...building.center, roof + 3), building.id);
    }
    // 출발 지점 표시: 땅에 고리 + 기둥 + 머리. 건물보다 위에 그려 가려지지 않게 한다.
    const markerColors = { bus: "#2563eb", parking: "#2563eb", gate: "#1b2333" };
    const overlay = (color, extra = {}) =>
      new THREE.MeshBasicMaterial({
        color,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        fog: false,
        ...extra,
      });
    for (const item of MAP_MARKERS) {
      const at = markerCoordinate(item.id);
      if (!at) continue;
      const base = point(at.east, at.north, at.elevation);
      const height = 14;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(3, 4.6, 32),
        overlay("#ffffff", { opacity: 0.75, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(base).add(new THREE.Vector3(0, 0.3, 0));
      ring.renderOrder = 7;
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.5, height, 8),
        overlay("#ffffff", { opacity: 0.95 }),
      );
      pole.position.copy(base).add(new THREE.Vector3(0, height / 2, 0));
      pole.renderOrder = 8;
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(3.6, 20, 14),
        overlay(markerColors[item.kind]),
      );
      const top = base.y + height + 2.4;
      head.position.set(base.x, top, base.z);
      head.renderOrder = 9;
      const hit = new THREE.Mesh(
        new THREE.CylinderGeometry(10, 10, height + 10, 12),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      );
      hit.position.copy(base).add(new THREE.Vector3(0, (height + 10) / 2, 0));
      hit.userData = { markerId: item.id };
      world.add(ring, pole, head, hit);
      markers.push({ ...item, head, ring, hit, top });
      bounds.expandByPoint(base);
      bounds.expandByPoint(head.position);
      addLabel(item.label, new THREE.Vector3(base.x, top + 5, base.z), item.id, item.kind);
    }
    // 그림자 범위를 캠퍼스 전체에 맞추고 한 번만 그린다.
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    light.target.position.copy(sphere.center);
    light.position.copy(sphere.center).addScaledVector(SUN_DIRECTION, sphere.radius * 2.5);
    Object.assign(light.shadow.camera, {
      left: -sphere.radius,
      right: sphere.radius,
      top: sphere.radius,
      bottom: -sphere.radius,
      near: sphere.radius * 0.5,
      far: sphere.radius * 4.5,
    });
    light.shadow.camera.updateProjectionMatrix();
    renderer.shadowMap.needsUpdate = true;
    highlight();
    container.append(canvas, labelLayer, compass);
    controls.addEventListener("change", scheduleRender);
    canvas.addEventListener("pointerdown", pointerDown);
    // 지도 밖에서 손을 떼어도 이전 드래그가 다음 선택에 남지 않게 해요.
    canvas.ownerDocument.addEventListener("pointermove", pointerMove);
    canvas.ownerDocument.addEventListener("pointerup", pointerUp);
    canvas.ownerDocument.addEventListener("pointercancel", pointerCancel);
    canvas.addEventListener("lostpointercapture", pointerCancel);
    canvas.addEventListener("webglcontextlost", contextLost);
    observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
  } catch (error) {
    dispose();
    throw error;
  }

  return {
    fitAll,
    showRoute,
    showPosition(position) {
      mePosition = position
        ? point(position.east, position.north, position.elevation + 1.2)
        : null;
      scheduleRender();
    },
    zoom(factor) {
      const offset = camera.position.clone().sub(controls.target);
      const distance = THREE.MathUtils.clamp(
        offset.length() * factor,
        controls.minDistance,
        controls.maxDistance,
      );
      camera.position.copy(controls.target).add(offset.setLength(distance));
      controls.update();
      scheduleRender();
    },
    selectBuilding(id) {
      const building = campusMap.buildings.find((b) => b.id === id);
      if (!building) return;
      select({ buildingId: id });
      fitBox(buildingBounds.get(id));
    },
    highlightBuildings(ids, current) {
      routeIds = ids;
      currentId = current;
      highlight();
    },
    dispose,
  };
}
