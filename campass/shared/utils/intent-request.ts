import type { IntentResult } from "../types/recognition.ts";

// 다음 질문이나 화면 이동 뒤 도착한 이전 응답은 사용하지 않아요.
export function createIntentRequest(request: (query: string, signal: AbortSignal) => Promise<IntentResult>) {
  let revision = 0;
  let active: { query: string; controller: AbortController; promise: Promise<IntentResult | null> } | null = null;
  return {
    cancel() {
      revision++;
      active?.controller.abort();
      active = null;
    },
    run(query: string): Promise<IntentResult | null> {
      if (active?.query === query) return active.promise;
      active?.controller.abort();
      const current = ++revision;
      const controller = new AbortController();
      let requested: Promise<IntentResult>;
      try {
        requested = Promise.resolve(request(query, controller.signal));
      } catch (error) {
        requested = Promise.reject(error);
      }
      const promise = requested.then((result) =>
        current === revision && !controller.signal.aborted ? result : null,
      (error) => {
        if (current !== revision || controller.signal.aborted) return null;
        throw error;
      }).finally(() => {
        if (active?.controller === controller) active = null;
      });
      active = { query, controller, promise };
      return promise;
    },
  };
}
