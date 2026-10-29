// Compare the retained evidence fields without depending on JSON object key order.
export function evidenceFingerprint(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(evidenceFingerprint).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${evidenceFingerprint(item)}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
