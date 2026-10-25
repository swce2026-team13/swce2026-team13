export async function api<T>(
  path: string,
  body?: unknown,
  token?: string,
): Promise<T> {
  const isForm = body instanceof FormData;
  const response = await fetch(`/api/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body !== undefined && !isForm
        ? { "Content-Type": "application/json" }
        : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: isForm ? body : JSON.stringify(body),
  });
  const value = await response.json();
  if (!response.ok)
    throw new Error(value.error?.message || "요청을 완료하지 못했어요.");
  return value;
}
