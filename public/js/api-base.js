const AUTH_TOKEN_KEY = "portfolio_jwt";

export function apiBase() {
  const meta = document.querySelector('meta[name="api-base"]');
  if (meta && meta.getAttribute("content")) {
    const v = meta.getAttribute("content").trim();
    if (v) {
      return v.replace(/\/$/, "");
    }
  }
  return "";
}

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
  const { headers: optHeaders, ...rest } = options;
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
  return fetch(apiUrl(path), fetchOpts);
}
