import { google } from "googleapis";

function stripOuterQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function parseServiceAccountJson(): Record<string, unknown> {
  let raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON is not configured. Add it in Vercel → Settings → Environment Variables."
    );
  }

  raw = stripOuterQuotes(raw);

  const candidates = [
    raw,
    raw.replace(/\\n/g, "\n"),
    raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf-8"),
  ];

  for (const candidate of candidates) {
    const normalized = stripOuterQuotes(candidate.trim());
    if (!normalized) continue;
    try {
      const parsed = JSON.parse(normalized) as Record<string, unknown>;
      if (parsed.client_email && parsed.private_key) {
        return parsed;
      }
    } catch {
      // try next candidate
    }
  }

  throw new Error(
    "GOOGLE_SERVICE_ACCOUNT_JSON is invalid JSON. Paste the full service-account JSON as one line in Vercel, or base64-encode the file and paste that instead."
  );
}

export function getGoogleAuth(scopes: string[]) {
  const credentials = parseServiceAccountJson();
  return new google.auth.GoogleAuth({
    credentials,
    scopes,
  });
}

export const SHEETS_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
];

export const DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive",
];

export const ALL_GOOGLE_SCOPES = [...SHEETS_SCOPES, ...DRIVE_SCOPES];
