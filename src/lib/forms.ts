import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

// POSTs JSON and throws an Error carrying the API's message and per-field
// errors (from hono-app's fieldErrors) on failure.
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fieldErrors: Record<string, string> = {}
  ) {
    super(message);
  }
}

export async function sendJson<T = unknown>(url: string, body?: unknown, method = "POST"): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
  });
  if (res.status === 401 && url.startsWith("/api/admin/") && !url.startsWith("/api/admin/login")) {
    // Admin session expired: a full page load so no stale dashboard state survives.
    window.location.replace("/admin/login");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? "Something went wrong", res.status, data.fieldErrors);
  return data as T;
}

// Shows server-side validation errors on the matching react-hook-form fields;
// returns whether any field matched.
export function applyFieldErrors<T extends FieldValues>(setError: UseFormSetError<T>, err: unknown) {
  if (!(err instanceof ApiError)) return false;
  const entries = Object.entries(err.fieldErrors);
  for (const [name, message] of entries) {
    setError(name as Path<T>, { type: "server", message });
  }
  return entries.length > 0;
}
