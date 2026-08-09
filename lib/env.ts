/** Trim env values; strip real/literal CRLF that sometimes pollute Vercel vars. */
export function cleanEnv(value: string | undefined | null): string | undefined {
  if (value == null) return undefined;
  let v = value.trim();
  v = v.replace(/\\r\\n/g, "").replace(/\\n/g, "").replace(/[\r\n]+/g, "");
  v = v.trim();
  return v || undefined;
}
