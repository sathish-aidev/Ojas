/** Safely read error message from API response (handles empty/non-JSON bodies). */
export async function readApiError(res: Response, fallback = "Request failed"): Promise<string> {
  try {
    const text = await res.text();
    if (!text.trim()) return `${fallback} (${res.status})`;
    const data = JSON.parse(text) as { error?: string; message?: string };
    return data.error ?? data.message ?? `${fallback} (${res.status})`;
  } catch {
    return `${fallback} (${res.status})`;
  }
}

export async function readApiJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(`Empty response (${res.status})`);
  }
  return JSON.parse(text) as T;
}
