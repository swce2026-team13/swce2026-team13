// Keep the same pinned runtime as the supplied HTML. No global script in layout.tsx:
// Three.js is fetched only when a map is opened, and failed loads can be retried.
const THREE_URL =
  "https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js";
const CONTROLS_URL =
  "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js";
/** @type {Promise<unknown> | undefined} */
let pending;

/** @param {string} src */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const timeout = window.setTimeout(
      () => finish(new Error("지도 로딩 시간 초과")),
      15000,
    );
    function finish(error) {
      window.clearTimeout(timeout);
      script.onload = null;
      script.onerror = null;
      if (error) {
        script.remove();
        reject(error);
      } else {
        resolve(undefined);
      }
    }
    script.src = src;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => finish();
    script.onerror = () =>
      finish(new Error("지도 라이브러리를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
}

/** @returns {Promise<unknown>} */
export function loadCampusThree() {
  if (!pending) {
    pending = (async () => {
      if (!window.THREE) await loadScript(THREE_URL);
      if (window.THREE?.REVISION !== "128")
        throw new Error("지원하지 않는 지도 라이브러리 버전입니다.");
      if (!window.THREE.OrbitControls) await loadScript(CONTROLS_URL);
      if (!window.THREE.OrbitControls)
        throw new Error("지도 조작 기능을 불러오지 못했습니다.");
      return window.THREE;
    })().catch((error) => {
      pending = undefined;
      throw error;
    });
  }
  return pending;
}
