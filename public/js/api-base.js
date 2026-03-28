import { API_BASE as CONFIG_BASE } from "./api-config.js";

const PLACEHOLDER = "YOUR-RAILWAY";

/** Shown on Contact and Meals when API_BASE is unset or still the placeholder (Firebase has no /api — requests must go to Railway). */
export function missingApiBaseUserMessage() {
  return "Set API_BASE in public/js/api-config.js to your Railway HTTPS URL, then redeploy hosting (e.g. firebase deploy --only hosting).";
}

export function apiBase() {
  if (
    typeof CONFIG_BASE === "string" &&
    CONFIG_BASE &&
    !CONFIG_BASE.includes(PLACEHOLDER)
  ) {
    return CONFIG_BASE.replace(/\/$/, "");
  }
  const meta = document.querySelector('meta[name="api-base"]');
  if (meta) {
    const v = meta.getAttribute("content");
    if (v && !v.includes(PLACEHOLDER)) {
      return v.trim().replace(/\/$/, "");
    }
  }
  return "";
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
  const ms = Number(timeoutMs ?? 25000);
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
