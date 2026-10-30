import {
  campusMap,
  routeSegments,
  getFloorElevations,
  toScenePosition,
  MAP_HEIGHT_SCALE,
  PLAZA_ELEVATION,
} from "../../../shared/utils/campus-map.ts";
import styles from "../../../styles/campus-map.module.css";

/**
 * 팀의 건물 윤곽을 그려요. 경로 계산은 기존 그래프에 맡겨요.
 * @param {*} THREE 지도 렌더링 모듈
 * @param {HTMLDivElement} container
 * @param {{ onSelect: (selection: import('../../../shared/utils/campus-map.ts').MapSelection | null) => void,
 *   onError: () => void, interactive?: boolean }} events
 * @returns {import('../../../shared/utils/campus-map.ts').CampusMapController}
 */
export function createCampusScene(THREE, container, events) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const canvas = renderer.domElement;
  canvas.setAttribute(
    "aria-label",
    "서경대학교 3D 캠퍼스 지도. 건물 선택 메뉴로도 탐색할 수 있어요.",
  );
  canvas.setAttribute("role", "img");
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#e8effd");
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
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9bc4, 0.95));
  const light = new THREE.DirectionalLight(0xffffff, 0.55);
  light.position.set(-160, 320, 220);
  scene.add(light);
  const world = new THREE.Group();
  scene.add(world);
  const routeLayer = new THREE.Group();
  world.add(routeLayer);
  const labelLayer = document.createElement("div");
  labelLayer.className = styles.labels;
  labelLayer.setAttribute("aria-hidden", "true");
  const compass = document.createElement("div");
  compass.className = styles.north;
  compass.setAttribute("aria-hidden", "true");
  compass.innerHTML = "<span>↑</span><b>N</b>";
  const bounds = new THREE.Box3();
  const buildingBounds = new Map();
  const floors = [];
  const labels = [];
  let selectedId = null;
  let routeIds = [];
  let currentId;
  let plazaMesh;
  let frame = 0;
  let disposed = false;
  let observer;

  const point = (east, north, elevation) =>
    new THREE.Vector3(...toScenePosition({ east, north, elevation }));
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
  function addLabel(text, position, buildingId) {
    const element = document.createElement("span");
    element.className = styles.label;
    element.textContent = text;
    labelLayer.appendChild(element);
    labels.push({ element, position, buildingId });
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
    // 작은 화면에서는 현재 건물 이름을 우선하고 겹치는 이름은 숨겨요.
    const ordered = [...labels].sort(
      (a, b) =>
        Number(b.buildingId === (currentId ?? selectedId)) -
          Number(a.buildingId === (currentId ?? selectedId)) ||
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
      label.element.dataset.selected = String(
        Boolean(
          (currentId ?? selectedId) &&
          label.buildingId === (currentId ?? selectedId),
        ),
      );
      if (!hidden) {
        label.element.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
        occupied.push(box);
      }
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
      floor.mesh.material.color.set(
        !events.interactive && active
          ? "#1747b5"
          : role === 0
            ? "#2563eb"
            : events.interactive && role === 1
              ? "#ef4444"
              : role >= 0 || active
                ? "#5c8cf1"
                : "#d3def7",
      );
      floor.mesh.material.opacity = role >= 0 || active ? 0.95 : floor.opacity;
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
          new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false, transparent: true }),
        );
        cap.position.copy(position);
        cap.renderOrder = order;
        routeLayer.add(cap);
      }
    }
    scheduleRender();
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
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
    labelLayer.remove();
    compass.remove();
  }

  try {
    for (const contour of campusMap.contours) {
      const geometry = new THREE.BufferGeometry().setFromPoints(
        contour.p.map((p) => point(p[0], p[1], contour.e)),
      );
      world.add(
        new THREE.Line(
          geometry,
          new THREE.LineBasicMaterial({
            color: "#b39a74",
            transparent: true,
            opacity: contour.m ? 0.55 : 0.25,
          }),
        ),
      );
    }
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
      building.floors.forEach((floor, i) => {
        const top = elevations[i + 1] ?? roof;
        const geometry = new THREE.ExtrudeGeometry(shape(building.poly), {
          depth: Math.max(0.6, (top - elevations[i]) * MAP_HEIGHT_SCALE * 0.86),
          bevelEnabled: false,
        });
        geometry.rotateX(-Math.PI / 2);
        const opacity = building.approx ? 0.3 : floor.passOnly ? 0.45 : 0.82;
        const material = new THREE.MeshLambertMaterial({
          color: "#d3def7",
          transparent: true,
          opacity,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.y = point(0, 0, elevations[i]).y;
        mesh.userData = { buildingId: building.id, floor: floor.floor };
        mesh.renderOrder = 1;
        const edge = new THREE.LineSegments(
          new THREE.EdgesGeometry(geometry, 25),
          new THREE.LineBasicMaterial({
            color: "#8ea4d8",
            transparent: true,
            opacity: 0.55,
          }),
        );
        edge.position.copy(mesh.position);
        world.add(mesh, edge);
        floors.push({ mesh, edge, opacity });
      });
      addLabel(building.name, point(...building.center, roof + 3), building.id);
    }
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
