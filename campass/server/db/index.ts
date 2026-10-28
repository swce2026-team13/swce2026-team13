import { Store } from "./store.ts";
const globals = globalThis as typeof globalThis & { campassStore?: Store };
export function database() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL must be configured on the server");
  return (globals.campassStore ??= new Store(url));
}
