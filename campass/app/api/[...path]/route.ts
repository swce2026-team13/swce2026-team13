import { NextRequest, NextResponse } from "next/server";
import { campus, places, searchPlaces } from "@/lib/catalog";
import { AppError, calculateRoute, waypoints } from "@/lib/routing";
import {
  assertRequestOrigin,
  database,
  loginAdmin,
  ownerToken,
  readBytes,
  readJson,
  requireAdmin,
  textField,
  versionField,
} from "@/lib/server";
import { interpretIntent, recognizePhoto } from "@/lib/providers";
import { allPlaces, findPlace } from "@/lib/rooms";
import { ADMIN_SESSION_SECONDS } from "@/lib/store";
async function handle(request: NextRequest) {
  const { token, owner } = ownerToken(
    request.cookies.get("campass_owner")?.value,
  );
  const response = (data: unknown, status = 200) => {
    const result = NextResponse.json(data, {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
    result.cookies.set("campass_owner", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return result;
  };
  try {
    const parts = request.nextUrl.pathname.replace(/^\/api\//, "").split("/");
    const method = request.method;
    if (method !== "GET") {
      assertRequestOrigin(request, process.env.APP_ORIGIN);
    }
    const db = database();
    db.limit(`request:${owner}`, 180, 60000);
    const adminSession = request.cookies.get("campass_admin")?.value;
    const adminCookieOptions = {
      httpOnly: true,
      sameSite: "strict" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
    };
    if (method === "POST" && parts.join("/") === "admin/login") {
      const body = await readJson(request);
      // 배포 프록시가 X-Forwarded-For를 실제 접속 IP로 덮어써야 함
      const address =
        request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ||
        "unknown";
      const session = loginAdmin(db, body, address);
      if (adminSession) db.deleteAdminSession(adminSession);
      const result = response({ ok: true });
      result.cookies.set("campass_admin", session.id, {
        ...adminCookieOptions,
        maxAge: ADMIN_SESSION_SECONDS,
        expires: new Date(session.expires),
      });
      return result;
    }
    if (method === "POST" && parts.join("/") === "admin/logout") {
      if (adminSession) db.deleteAdminSession(adminSession);
      const result = response({ ok: true });
      result.cookies.set("campass_admin", "", {
        ...adminCookieOptions,
        maxAge: 0,
        expires: new Date(0),
      });
      return result;
    }
    if (parts[0] === "admin") requireAdmin(adminSession, db);
    if (method === "GET" && parts.join("/") === "health")
      return response({ ok: true, service: "campass", schema: 1 });
    if (method === "GET" && parts.join("/") === "catalog")
      return response({
        campus,
        places,
        waypoints,
        visionEnabled: Boolean(process.env.VISION_API_URL),
        intentEnabled: Boolean(process.env.INTENT_API_URL),
      });
    if (method === "GET" && parts.join("/") === "places") {
      const q = request.nextUrl.searchParams.get("q") || "";
      if (q.length > 200)
        throw new AppError("검색어는 200자 이내로 입력해 주세요.");
      return response({
        places: searchPlaces(
          q,
          request.nextUrl.searchParams.get("category") || undefined,
          request.nextUrl.searchParams.get("building") || undefined,
          allPlaces(),
        ),
      });
    }
    // 화면에 없는 장소(호실)를 id로 찾을 때 씀
    if (method === "GET" && parts[0] === "places" && parts.length === 2) {
      const place = findPlace(decodeURIComponent(parts[1]));
      if (!place)
        throw new AppError("장소를 찾을 수 없어요.", 404, "NOT_FOUND");
      return response({ place });
    }
    if (method === "GET" && parts.join("/") === "route-insights") {
  const start = textField(request.nextUrl.searchParams.get("start"));
  const destination = textField(
    request.nextUrl.searchParams.get("destination"),
  );

  const elevatorValue = request.nextUrl.searchParams.get("elevator");

  if (elevatorValue !== "true" && elevatorValue !== "false") {
    throw new AppError("엘리베이터 옵션을 확인해 주세요.");
  }

  // 경로 후보 id. 없으면 첫 후보
  const option = request.nextUrl.searchParams.get("option") || undefined;
  const route = calculateRoute(
    start,
    destination,
    elevatorValue === "true",
    allPlaces(),
    { option },
  );

  const routeIds = new Set(route.steps.map((step) => step.id));
  const insight = db.insights();

  const points = insight.points.filter((point) =>
    routeIds.has(point.id),
  );

  return response({
    points,
    scope: "current-route",
    dataMode: insight.dataMode,
  });
}
    if (method === "GET" && parts.join("/") === "admin/insights") {
      return response(db.insights());
    }
    if (method === "GET" && parts[0] === "sessions" && parts.length === 2)
      return response(db.get(parts[1], owner));
    if (method === "POST" && parts.join("/") === "recognize") {
      db.limit(`vision:${owner}`, 10, 60000);
      db.limit("vision-global", 100, 3600000);
      if (
        !request.headers.get("content-type")?.startsWith("multipart/form-data")
      )
        throw new AppError("사진 파일을 첨부해 주세요.", 415, "CONTENT_TYPE");
      const bytes = await readBytes(request, 6 * 1024 * 1024);
      let form: FormData;
      try {
        form = await new Response(bytes, {
          headers: { "Content-Type": request.headers.get("content-type")! },
        }).formData();
      } catch {
        throw new AppError("사진 업로드 형식을 확인해 주세요.");
      }
      const image = form.get("image");
      if (
        !(image instanceof File) ||
        image.size > 5 * 1024 * 1024 ||
        image.size < 12
      )
        throw new AppError("5MB 이하의 JPG, PNG, WebP 사진을 선택해 주세요.");
      const head = Buffer.from(await image.slice(0, 12).arrayBuffer());
      const valid =
        (image.type === "image/jpeg" &&
          head[0] === 255 &&
          head[1] === 216 &&
          head[2] === 255) ||
        (image.type === "image/png" &&
          head
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
        (image.type === "image/webp" &&
          head.toString("ascii", 0, 4) === "RIFF" &&
          head.toString("ascii", 8, 12) === "WEBP");
      if (!valid)
        throw new AppError(
          "지원하는 이미지 형식이 아니에요. JPG, PNG, WebP를 선택해 주세요.",
        );
      return response(await recognizePhoto(image));
    }
    if (
  method === "POST" &&
  parts.join("/") === "recognition-feedback"
) {
  const body = await request.json();

  const predictedWaypointId = textField(body.predictedWaypointId);
  const confidence = Number(body.confidence);
  const direction = body.direction;

  if (
    !Number.isFinite(confidence) ||
    confidence < 0 ||
    confidence > 1 ||
    !["forward", "backward", "unknown"].includes(direction)
  ) {
    throw new AppError(
      "사진 인식 피드백 내용을 확인해 주세요.",
    );
  }

  return response(
    db.recognitionFeedback({
      predictedWaypointId,
      confidence,
      direction,
      correctedWaypointId:
        body.correctedWaypointId === undefined
          ? undefined
          : textField(body.correctedWaypointId),
    }),
  );
}
    if (method === "POST") {
      const body = await readJson(request);
      if (parts.join("/") === "intent") {
        db.limit(`intent:${owner}`, 20, 60000);
        db.limit("intent-global", 300, 3600000);
        return response(await interpretIntent(textField(body.query)));
      }
      if (parts.join("/") === "routes" || parts.join("/") === "sessions") {
        const start = textField(body.start),
          destination = textField(body.destination);
        if (typeof body.elevator !== "boolean")
          throw new AppError("엘리베이터 옵션을 확인해 주세요.");
        // 경로 후보 id. 없으면 첫 후보
        const option =
          body.option === undefined ? undefined : textField(body.option, 40);
        if (parts[0] === "routes")
          return response(
            calculateRoute(start, destination, body.elevator, allPlaces(), {
              option,
            }),
          );
        db.limit(`create:${owner}`, 20, 60000);
        return response(
          db.create(owner, start, destination, body.elevator, option),
          201,
        );
      }
      if (parts[0] === "sessions" && parts.length === 3) {
        const id = parts[1];
        switch (parts[2]) {
          case "advance":
            return response(db.advance(id, owner, versionField(body.version)));
          case "confusion":
            return response(db.confusion(id, owner));
          case "recover": {
            const direction = body.direction ?? "unknown";
            if (
              direction !== "forward" &&
              direction !== "backward" &&
              direction !== "unknown"
            )
              throw new AppError("위치 방향을 확인해 주세요.");
            return response(
              db.recover(
                id,
                owner,
                textField(body.waypointId),
                versionField(body.version),
                direction,
              ),
            );
          }
          case "feedback": {
            if (
              typeof body.confused !== "boolean" ||
              (body.comment !== undefined &&
                (typeof body.comment !== "string" || body.comment.length > 500))
            )
              throw new AppError("피드백 내용을 확인해 주세요.");
            return response(
              db.feedback(id, owner, {
                confused: body.confused,
                waypointId:
                  body.waypointId === undefined
                    ? undefined
                    : textField(body.waypointId),
                reason:
                  body.reason === undefined
                    ? undefined
                    : textField(body.reason, 30),
                comment: body.comment as string | undefined,
              }),
            );
          }
        }
      }
    }
    throw new AppError("요청한 API를 찾을 수 없어요.", 404, "NOT_FOUND");
  } catch (error) {
    if (error instanceof AppError)
      return response(
        { error: { code: error.code, message: error.message } },
        error.status,
      );
    console.error(
      "Campass request failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return response(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.",
        },
      },
      500,
    );
  }
}
export const GET = handle;
export const POST = handle;
