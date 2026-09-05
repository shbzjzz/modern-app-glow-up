export const CF_API = "https://exp.galamarkets.workers.dev";

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

export function readToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token")
  );
}

export async function apiFetch(url: string, options: RequestInit = {}) {
  const token = readToken();
  const headers = new Headers(options.headers as HeadersInit | undefined);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    onUnauthorized?.();
    throw new Error("Unauthorized");
  }
  return res;
}

export function apiGet<T = unknown>(action: string, params = ""): Promise<T> {
  return apiFetch(`${CF_API}?action=${action}${params}&_t=${Date.now()}`).then(
    (r) => r.json() as Promise<T>,
  );
}

export function apiPost<T = unknown>(action: string, body?: unknown): Promise<T> {
  return apiFetch(`${CF_API}?action=${action}`, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).then((r) => r.json() as Promise<T>);
}
