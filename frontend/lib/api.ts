import type { ApiEnvelope } from "@queueflow/shared";

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let csrfValue = "";
let csrfRequest: Promise<void> | null = null;

function apiBase() {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, "") ?? "";
  const root = configured || "/api";
  return root.endsWith("/api") ? root : `${root}/api`;
}
function apiUrl(path: string) {
  if (path.startsWith("/api/")) return `${apiBase().replace(/\/api$/, "")}${path}`;
  return `${apiBase()}${path.startsWith("/") ? path : `/${path}`}`;
}
function readCsrfCookie() {
  if (typeof document === "undefined") return "";
  const value =
    document.cookie
      .split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith("queueflow_csrf="))
      ?.slice("queueflow_csrf=".length) ?? "";
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}
function responseCsrf(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const data = (payload as { data?: unknown }).data;
  return data &&
    typeof data === "object" &&
    typeof (data as { csrfToken?: unknown }).csrfToken === "string"
    ? (data as { csrfToken: string }).csrfToken
    : "";
}

async function ensureCsrf() {
  csrfValue ||= readCsrfCookie();
  if (csrfValue) return;
  csrfRequest ??= fetch(apiUrl("/auth/csrf"), { credentials: "include", cache: "no-store" })
    .then(async (response) => {
      const payload = await response.json().catch(() => null);
      if (!response.ok)
        throw new ApiError(
          "Could not establish a secure session.",
          response.status,
          "CSRF_BOOTSTRAP_FAILED",
        );
      csrfValue = responseCsrf(payload);
      if (!csrfValue)
        throw new ApiError(
          "The server did not provide a CSRF token.",
          response.status,
          "CSRF_TOKEN_MISSING",
        );
    })
    .finally(() => {
      csrfRequest = null;
    });
  await csrfRequest;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const changesState = !["GET", "HEAD", "OPTIONS"].includes(method);
  if (changesState) await ensureCsrf();
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (changesState && csrfValue) headers.set("X-CSRF-Token", csrfValue);
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...init,
      method,
      headers,
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      "The server could not be reached. Check that the API is running.",
      0,
      "NETWORK_ERROR",
    );
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const envelope = payload as ApiEnvelope<unknown> | null;
    const raw = payload as {
      message?: string;
      error?: string | { code?: string; message?: string; details?: unknown };
    } | null;
    const nested =
      envelope && !envelope.success && typeof envelope.error === "object" ? envelope.error : null;
    const message =
      nested?.message ??
      (typeof raw?.error === "string" ? raw.error : undefined) ??
      raw?.message ??
      "Something went wrong.";
    throw new ApiError(message, response.status, nested?.code, nested?.details);
  }
  const csrf = responseCsrf(payload);
  if (csrf) csrfValue = csrf;
  if (path.includes("/auth/logout")) csrfValue = "";
  const envelope = payload as ApiEnvelope<T> | null;
  if (envelope && typeof envelope === "object" && "success" in envelope && envelope.success)
    return envelope.data;
  return payload as T;
}

export const jsonBody = (value: unknown) => JSON.stringify(value);
