import { API_BASE as CONFIG_BASE } from "./api-config.js?v=4";

const PLACEHOLDER = "YOUR-RAILWAY";

/** Shown when no API base is resolved (Firebase has no /api — use Railway URL). */
export function missingApiBaseUserMessage() {
  return "API URL missing. Hard-refresh (Ctrl+Shift+R). If it persists, redeploy Firebase hosting.";
}

function normalizeBase(v) {
  if (typeof v !== "string" || !v) return "";
  const s = v.trim().replace(/\/$/, "");
  if (!s || s.includes(PLACEHOLDER)) return "";
  return s;
}

export function apiBase() {
  if (typeof window !== "undefined" && window.__PORTFOLIO_API_BASE__) {
    const b = normalizeBase(String(window.__PORTFOLIO_API_BASE__));
    if (b) return b;
  }
  const meta = document.querySelector('meta[name="api-base"]');
  if (meta) {
    const b = normalizeBase(meta.getAttribute("content") || "");
    if (b) return b;
  }
  const b = normalizeBase(typeof CONFIG_BASE === "string" ? CONFIG_BASE : "");
  return b;
}

const AUTH_TOKEN_KEY = "portfolio_jwt";

export function getAuthToken() {
  try {
    return sessionStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token) {
  try {
    if (token) {
      sessionStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function clearAuthToken() {
  setAuthToken(null);
}

export function apiUrl(path) {
  const base = apiBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

export async function apiFetch(path, options = {}) {
  const { headers: optHeaders, signal: userSignal, timeoutMs, ...rest } = options;
  const headers = { ...optHeaders };
  const isForm =
    typeof FormData !== "undefined" && rest.body && rest.body instanceof FormData;
  if (isForm) {
    delete headers["Content-Type"];
  } else if (rest.body && typeof rest.body === "string" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const token = getAuthToken();
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const fetchOpts = { credentials: "include", ...rest, headers };
  // Railway cold start / MySQL wake can exceed 25s; use 0 in options to disable timeout.
  const ms = timeoutMs === 0 ? 0 : Number(timeoutMs ?? 120000);
  if (ms > 0 && typeof AbortSignal !== "undefined" && AbortSignal.timeout) {
    const t = AbortSignal.timeout(ms);
    if (userSignal && typeof AbortSignal.any === "function") {
      fetchOpts.signal = AbortSignal.any([userSignal, t]);
    } else {
      fetchOpts.signal = t;
    }
  } else if (userSignal) {
    fetchOpts.signal = userSignal;
  }
  return fetch(apiUrl(path), fetchOpts);
}
