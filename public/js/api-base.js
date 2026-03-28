export function apiBase() {
  const meta = document.querySelector('meta[name="api-base"]');
  if (meta && meta.getAttribute("content")) {
    return meta.getAttribute("content").replace(/\/$/, "");
  }
  return "";
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
  const fetchOpts = { credentials: "include", ...rest };
  if (Object.keys(headers).length > 0) {
    fetchOpts.headers = headers;
  }
  return fetch(apiUrl(path), fetchOpts);
}
