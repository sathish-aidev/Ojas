import { google } from "googleapis";

function parseServiceAccountJson(): Record<string, unknown> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not configured");
  }

  try {
    const decoded = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf-8");
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is invalid JSON");
  }
}

export function getGoogleAuth(scopes: string[]) {
  const credentials = parseServiceAccountJson();
  return new google.auth.GoogleAuth({
    credentials,
    scopes,
  });
}

export const SHEETS_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets.readonly",
];

export const DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive",
];

export const ALL_GOOGLE_SCOPES = [...SHEETS_SCOPES, ...DRIVE_SCOPES];
