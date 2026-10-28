import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import type { Store } from "../db/store.ts";
import { database } from "../db/index.ts";
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
export async function loginAdmin(
  db: Store,
  input: Record<string, unknown>,
  address: string,
) {
  const id = process.env.ADMIN_ID;
  const password = process.env.ADMIN_PASSWORD;
  if (!id || !password || password.length < 12)
    throw new AppError(
      "관리자 인증이 설정되지 않았어요. 서버의 관리자 계정을 설정해 주세요.",
      503,
      "ADMIN_UNCONFIGURED",
    );
  const hash = (s: string) => createHash("sha256").update(s).digest();
  const key = `admin-login:${hash(address).toString("hex")}`;
  // 길이를 맞추려고 해시로 바꾼 뒤, 형식이 이상한 입력도 두 값을 항상 모두 비교
  const idMatches = timingSafeEqual(
    hash(typeof input.id === "string" ? input.id : ""),
    hash(id),
  );
  const passwordMatches = timingSafeEqual(
    hash(typeof input.password === "string" ? input.password : ""),
    hash(password),
  );
  return db.loginAttempt(key, idMatches && passwordMatches);
}
export async function requireAdmin(cookie: string | undefined, db = database()) {
  if (!cookie || !(await db.hasAdminSession(cookie)))
    throw new AppError(
      "관리자 인증 정보를 확인해 주세요.",
      401,
      "UNAUTHORIZED",
    );
}
