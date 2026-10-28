import type { Store } from "../../server/db/store.ts";
export type Insight = Awaited<ReturnType<Store["insights"]>>;
