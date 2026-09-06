/**
 * Create the TEST Drive folder + PT spreadsheet (dummy Google sandbox).
 * Uses live Google credentials only to create a child folder, then writes .env.staging.
 *
 *   npx tsx scripts/setup-staging-google.ts
 */
import { config } from "dotenv";
import { google } from "googleapis";
import { envFilePath, parseEnvFile, upsertEnvFile } from "./env-file";
import {
  TRAINER_SHEET_TABS,
  SHEET_HEADERS,
  PT_SPREADSHEET_NAME,
} from "../lib/sheet-config";

const TEST_FOLDER_NAME = "Impackt Fitness — TEST";
const TEST_SHEET_NAME = `${PT_SPREADSHEET_NAME} — TEST`;

process.env.ALLOW_PRODUCTION_GOOGLE = "1";
config({ path: ".env.vercel.production", override: true });

async function findChildFolder(
  drive: ReturnType<typeof google.drive>,
  parentId: string,
  name: string
) {
  const q = `'${parentId}' in parents and name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await drive.files.list({
    q,
    fields: "files(id,name)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files?.[0]?.id ?? null;
}

async function findChildSheet(
  drive: ReturnType<typeof google.drive>,
  parentId: string,
  name: string
) {
  const q = `'${parentId}' in parents and name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;
  const res = await drive.files.list({
    q,
    fields: "files(id,name)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files?.[0]?.id ?? null;
}

async function ensureTabs(spreadsheetId: string) {
  const { getGoogleAuth, ALL_GOOGLE_SCOPES } = await import("../lib/google/google-auth");
  const auth = getGoogleAuth(ALL_GOOGLE_SCOPES);
  const sheets = google.sheets({ version: "v4", auth });
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = new Set(
    (meta.data.sheets ?? []).map((sheet) => sheet.properties?.title).filter(Boolean) as string[]
  );
  const defaultSheetId = meta.data.sheets?.[0]?.properties?.sheetId ?? 0;
  const requests: object[] = [];
  if (!existing.has(TRAINER_SHEET_TABS[0])) {
    requests.push({
      updateSheetProperties: {
        properties: { sheetId: defaultSheetId, title: TRAINER_SHEET_TABS[0] },
        fields: "title",
      },
    });
  }
  for (const title of TRAINER_SHEET_TABS.slice(1)) {
    if (!existing.has(title)) requests.push({ addSheet: { properties: { title } } });
  }
  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  }
  for (const tab of TRAINER_SHEET_TABS) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${tab.replace(/'/g, "''")}'!A1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [
          [`${TEST_SHEET_NAME} | Trainer: ${tab} | Dummy TEST data | Dates: DD/MM/YYYY`],
          [...SHEET_HEADERS],
        ],
      },
    });
  }
}

async function main() {
  const prod = parseEnvFile(envFilePath(".env.vercel.production"));
  const liveFolder = prod.GOOGLE_DRIVE_FOLDER_ID;
  const liveSheet = prod.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!liveFolder) throw new Error("Production GOOGLE_DRIVE_FOLDER_ID is missing");

  const { getGoogleAuth, ALL_GOOGLE_SCOPES } = await import("../lib/google/google-auth");
  const auth = getGoogleAuth(ALL_GOOGLE_SCOPES);
  const drive = google.drive({ version: "v3", auth });

  let testFolderId = await findChildFolder(drive, liveFolder, TEST_FOLDER_NAME);
  if (!testFolderId) {
    const created = await drive.files.create({
      requestBody: {
        name: TEST_FOLDER_NAME,
        mimeType: "application/vnd.google-apps.folder",
        parents: [liveFolder],
      },
      fields: "id",
      supportsAllDrives: true,
    });
    testFolderId = created.data.id ?? null;
  }
  if (!testFolderId) throw new Error("Could not create TEST Drive folder");

  let testSheetId = await findChildSheet(drive, testFolderId, TEST_SHEET_NAME);
  if (!testSheetId) {
    try {
      const created = await drive.files.create({
        requestBody: {
          name: TEST_SHEET_NAME,
          mimeType: "application/vnd.google-apps.spreadsheet",
          parents: [testFolderId],
        },
        fields: "id",
        supportsAllDrives: true,
      });
      testSheetId = created.data.id ?? null;
    } catch (err) {
      console.warn(
        "Could not create the TEST spreadsheet with the service account (Drive quota).",
        err instanceof Error ? err.message : err
      );
      console.warn(
        `Create "${TEST_SHEET_NAME}" yourself in this folder, share it with the service account, then set GOOGLE_SHEETS_SPREADSHEET_ID:\n  https://drive.google.com/drive/folders/${testFolderId}`
      );
    }
  }

  upsertEnvFile(envFilePath(".env.staging"), {
    APP_ENV: "staging",
    NEXT_PUBLIC_APP_ENV: "staging",
    NEXT_PUBLIC_APP_NAME: "Impackt Fitness (TEST)",
    GOOGLE_DRIVE_FOLDER_ID: testFolderId,
    PRODUCTION_GOOGLE_DRIVE_FOLDER_ID: liveFolder,
    PRODUCTION_GOOGLE_SHEETS_SPREADSHEET_ID: liveSheet || "",
    GOOGLE_SERVICE_ACCOUNT_JSON: prod.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "",
    ...(testSheetId
      ? {
          GOOGLE_SHEETS_SPREADSHEET_ID: testSheetId,
          GOOGLE_EXPENSES_SPREADSHEET_ID: testSheetId,
        }
      : {}),
  });

  if (!testSheetId) {
    console.log("TEST Drive folder is ready, but the TEST spreadsheet still needs to be created by a Google user (not the service account).");
    console.log(`  Folder: https://drive.google.com/drive/folders/${testFolderId}`);
    return;
  }

  delete process.env.ALLOW_PRODUCTION_GOOGLE;
  process.env.GOOGLE_DRIVE_FOLDER_ID = testFolderId;
  process.env.GOOGLE_SHEETS_SPREADSHEET_ID = testSheetId;
  process.env.GOOGLE_EXPENSES_SPREADSHEET_ID = testSheetId;
  process.env.APP_ENV = "staging";

  await ensureTabs(testSheetId);
  const { ensureCultInvoiceFolders } = await import("../lib/google/drive-archive");
  const { ensureExpenseSheets } = await import("../lib/google/expense-sheet");
  await ensureCultInvoiceFolders();
  await ensureExpenseSheets();

  upsertEnvFile(envFilePath(".env.staging"), {
    APP_ENV: "staging",
    NEXT_PUBLIC_APP_ENV: "staging",
    NEXT_PUBLIC_APP_NAME: "Impackt Fitness (TEST)",
    GOOGLE_DRIVE_FOLDER_ID: testFolderId,
    GOOGLE_SHEETS_SPREADSHEET_ID: testSheetId,
    GOOGLE_EXPENSES_SPREADSHEET_ID: testSheetId,
    PRODUCTION_GOOGLE_DRIVE_FOLDER_ID: liveFolder,
    PRODUCTION_GOOGLE_SHEETS_SPREADSHEET_ID: liveSheet || "",
    GOOGLE_SERVICE_ACCOUNT_JSON: prod.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "",
  });

  console.log("TEST Google sandbox ready.");
  console.log(`  Folder: https://drive.google.com/drive/folders/${testFolderId}`);
  console.log(`  Sheet:  https://docs.google.com/spreadsheets/d/${testSheetId}`);
  console.log("  IDs written to .env.staging (gitignored).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
