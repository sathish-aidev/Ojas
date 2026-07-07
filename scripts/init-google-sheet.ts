/**
 * Create Ojas PT Tracker spreadsheet with 3 tabs in Google Drive.
 * Run: npx tsx scripts/init-google-sheet.ts
 */
import { google } from "googleapis";
import { getGoogleAuth, ALL_GOOGLE_SCOPES } from "../lib/google/google-auth";
import {
  TRAINER_SHEET_TABS,
  PT_SPREADSHEET_NAME,
  SHEET_HEADERS,
  getDriveFolderId,
  getOwnerReportEmail,
} from "../lib/sheet-config";
import { findSpreadsheetByName } from "../lib/google/drive-archive";

async function transferToOwner(drive: ReturnType<typeof google.drive>, fileId: string) {
  const ownerEmail = getOwnerReportEmail();
  await drive.permissions.create({
    fileId,
    requestBody: {
      type: "user",
      role: "owner",
      emailAddress: ownerEmail,
    },
    transferOwnership: true,
    supportsAllDrives: true,
  });
}

async function main() {
  const auth = getGoogleAuth(ALL_GOOGLE_SCOPES);
  const drive = google.drive({ version: "v3", auth });
  const sheets = google.sheets({ version: "v4", auth });
  const folderId = getDriveFolderId();

  const existing = await findSpreadsheetByName();
  if (existing) {
    console.log("\nSpreadsheet already exists!");
    console.log(`  ID: ${existing}`);
    console.log(`  URL: https://docs.google.com/spreadsheets/d/${existing}`);
    console.log(`\nGOOGLE_SHEETS_SPREADSHEET_ID=${existing}`);
    return;
  }

  const createRes = await drive.files.create({
    requestBody: {
      name: PT_SPREADSHEET_NAME,
      mimeType: "application/vnd.google-apps.spreadsheet",
      parents: [folderId],
    },
    fields: "id",
    supportsAllDrives: true,
  });

  const spreadsheetId = createRes.data.id;
  if (!spreadsheetId) throw new Error("Failed to create spreadsheet");

  try {
    await transferToOwner(drive, spreadsheetId);
  } catch (err) {
    console.warn(
      "Note: Could not transfer ownership to your Gmail — file may still work if folder is shared.",
      err instanceof Error ? err.message : err
    );
  }

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const defaultSheetId = meta.data.sheets?.[0]?.properties?.sheetId ?? 0;

  const requests: object[] = [
    {
      updateSheetProperties: {
        properties: { sheetId: defaultSheetId, title: TRAINER_SHEET_TABS[0] },
        fields: "title",
      },
    },
    ...TRAINER_SHEET_TABS.slice(1).map((title) => ({
      addSheet: { properties: { title } },
    })),
  ];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });

  for (const tab of TRAINER_SHEET_TABS) {
    const values = [
      [
        `Ojas PT Tracker | Trainer: ${tab} | Do not delete header row | Dates: DD/MM/YYYY`,
      ],
      [...SHEET_HEADERS],
      [
        "Sample Client",
        "01/03/2026",
        "01/04/2026",
        "yes 01/03/2026",
        "15000",
        "1",
        "PhonePe",
        "9876543210",
        "optional — delete this row",
      ],
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${tab.replace(/'/g, "''")}'!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });
  }

  console.log("\nSpreadsheet created successfully!");
  console.log(`  ID: ${spreadsheetId}`);
  console.log(`  URL: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
  console.log(`\nAdd to Vercel env: GOOGLE_SHEETS_SPREADSHEET_ID=${spreadsheetId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
