import { resolve } from "node:path";
import { Store } from "./store.ts";
const globals = globalThis as typeof globalThis & { campassStore?: Store };
export function database() {
  return (globals.campassStore ??= new Store(
    resolve(
      /* turbopackIgnore: true */ process.env.DATABASE_PATH ||
        "./data/campass.sqlite",
    ),
  ));
}
