import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { resolve } from "node:path";
import { Store } from "./store.ts";
import { AppError } from "./routing.ts";
const globals = globalThis as typeof globalThis & { campassStore?: Store };
export function database() {
  return (globals.campassStore ??= new Store(
    resolve(
      /* turbopackIgnore: true */ process.env.DATABASE_PATH ||
        "./data/campass.sqlite",
    ),
  ));
}
export function assertRequestOrigin(
  request: Request,
  configuredOrigin?: string,
) {
  const expected =
    configuredOrigin ||
    `${new URL(request.url).protocol}//${request.headers.get("host")}`;
  if (request.headers.get("origin") !== expected)
    throw new AppError(
      "허용되지 않은 요청 출처입니다.",
      403,
      "ORIGIN_REJECTED",
    );
}
export function ownerToken(cookie: string | undefined) {
  const token =
    cookie && /^[0-9a-f-]{36}$/.test(cookie) ? cookie : randomUUID();
  return { token, owner: createHash("sha256").update(token).digest("hex") };
}
export function requireAdmin(header: string | null) {
  const configured = process.env.ADMIN_TOKEN;
  if (!configured || configured.length < 24)
    throw new AppError(
      "관리자 인증이 설정되지 않았어요. 서버의 ADMIN_TOKEN을 설정해 주세요.",
      503,
      "ADMIN_UNCONFIGURED",
    );
  const supplied = header?.startsWith("Bearer ") ? header.slice(7) : "";
  const hash = (s: string) => createHash("sha256").update(s).digest();
  if (!timingSafeEqual(hash(supplied), hash(configured)))
    throw new AppError(
      "관리자 인증 정보를 확인해 주세요.",
      401,
      "UNAUTHORIZED",
    );
}
export async function readBytes(request: Request, limit: number) {
  if (Number(request.headers.get("content-length")) > limit)
    throw new AppError("파일 또는 요청 크기가 너무 커요.", 413, "TOO_LARGE");
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let count = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    count += value.byteLength;
    if (count > limit) {
      await reader.cancel();
      throw new AppError("파일 또는 요청 크기가 너무 커요.", 413, "TOO_LARGE");
    }
    chunks.push(value);
  }
  return new Uint8Array(Buffer.concat(chunks));
}
export async function readJson(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new AppError("JSON 형식으로 보내 주세요.", 415, "CONTENT_TYPE");
  try {
    const value = JSON.parse(
      new TextDecoder().decode(await readBytes(request, 16384)),
    );
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error();
    return value as Record<string, unknown>;
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError("요청 JSON을 확인해 주세요.");
  }
}
export function textField(value: unknown, max = 200) {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new AppError("입력 내용을 확인해 주세요.");
  return value.trim();
}
export function versionField(value: unknown) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new AppError("안내 버전을 확인해 주세요.");
  return value;
}
