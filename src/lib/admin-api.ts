// Fetch wrapper for the admin pages: sends the session cookie, bounces to the
// login page when the session has expired, and surfaces the API's error text.
export async function adminFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/admin${path}`, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
    credentials: "same-origin",
  });
  if (res.status === 401) {
    // A full page load (not router navigation) so no stale dashboard state survives.
    window.location.replace("/admin/login");
    throw new Error("Session expired");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}
