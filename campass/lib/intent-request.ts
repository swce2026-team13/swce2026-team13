import type { IntentResult } from "./providers.ts";

// 다음 질문이나 화면 이동 뒤 도착한 이전 응답은 사용하지 않아요.
export function createIntentRequest(request: (query: string) => Promise<IntentResult>) {
  let revision = 0;
  return {
    cancel() { revision++; },
    async run(query: string): Promise<IntentResult | null> {
      const current = ++revision;
      try {
        const result = await request(query);
        return current === revision ? result : null;
      } catch (error) {
        if (current !== revision) return null;
        throw error;
      }
    },
  };
}
