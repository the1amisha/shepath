/** Explicit shared configuration for live routes, evidence and saved comparison. */
export function apiBaseUrl() {
  const value = import.meta.env["VITE_API_BASE_URL"]?.trim();
  const guidance = "Set VITE_API_BASE_URL in frontend/.env.local (local demo: http://127.0.0.1:8011), then restart Vite or rebuild.";
  if (!value) throw new Error(guidance);
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error();
  } catch {
    throw new Error(`Invalid API URL. ${guidance}`);
  }
  return value.replace(/\/+$/, "");
}
