// 팀 지도에서 사용하는 고정 버전을 지도를 열 때만 불러와요. 실패하면 다시 시도할 수 있어요.
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
      finish(new Error("지도 라이브러리를 불러오지 못했어요."));
    document.head.appendChild(script);
  });
}

/** @returns {Promise<unknown>} */
export function loadCampusThree() {
  try {
    const canvas = document.createElement("canvas");
    const context =
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!context)
      return Promise.reject(new Error("3D 지도를 사용할 수 없어요."));
    context.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    return Promise.reject(new Error("3D 지도를 사용할 수 없어요."));
  }
  if (!pending) {
    pending = (async () => {
      if (!window.THREE) await loadScript(THREE_URL);
      if (window.THREE?.REVISION !== "128")
        throw new Error("지원하지 않는 지도 라이브러리 버전이에요.");
      if (!window.THREE.OrbitControls) await loadScript(CONTROLS_URL);
      if (!window.THREE.OrbitControls)
        throw new Error("지도 조작 기능을 불러오지 못했어요.");
      return window.THREE;
    })().catch((error) => {
      pending = undefined;
      throw error;
    });
  }
  return pending;
}
