/** Shared live-routing configuration; retain the existing development fallback. */
export function apiBaseUrl() {
  return (import.meta.env["VITE_API_BASE_URL"] || "http://127.0.0.1:8000").replace(/\/+$/, "");
}
