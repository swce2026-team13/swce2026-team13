import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { AppError } from "../../shared/utils/routing.ts";
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
