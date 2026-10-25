import { AppError } from "../../shared/utils/routing.ts";
export { database } from "../db/index.ts";
export { assertRequestOrigin, ownerToken, requireAdmin } from "../auth/index.ts";
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
