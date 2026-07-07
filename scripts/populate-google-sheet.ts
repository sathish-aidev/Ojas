/**
 * Configure tabs/headers on an existing user-created spreadsheet.
 * Usage: npx tsx scripts/populate-google-sheet.ts <spreadsheetId>
 */
import { google } from "googleapis";
import { getGoogleAuth, ALL_GOOGLE_SCOPES } from "../lib/google/google-auth";
import { TRAINER_SHEET_TABS, SHEET_HEADERS } from "../lib/sheet-config";
import { findSpreadsheetByName } from "../lib/google/drive-archive";

async function populate(spreadsheetId: string) {
  const auth = getGoogleAuth(ALL_GOOGLE_SCOPES);
  const sheets = google.sheets({ version: "v4", auth });

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existingTabs =
    meta.data.sheets?.map((s) => s.properties?.title).filter(Boolean) ?? [];

  const requests: object[] = [];
  const firstSheetId = meta.data.sheets?.[0]?.properties?.sheetId ?? 0;
  const firstTitle = existingTabs[0];

  if (
    existingTabs.length === 1 &&
    (firstTitle === "Sheet1" || !firstTitle) &&
    !existingTabs.includes(TRAINER_SHEET_TABS[0])
  ) {
    requests.push({
      updateSheetProperties: {
        properties: { sheetId: firstSheetId, title: TRAINER_SHEET_TABS[0] },
        fields: "title",
      },
    });
    existingTabs[0] = TRAINER_SHEET_TABS[0];
  }

  for (const tab of TRAINER_SHEET_TABS) {
    if (!existingTabs.includes(tab)) {
      requests.push({ addSheet: { properties: { title: tab } } });
    }
  }

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    });
  }

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

  console.log("\nSpreadsheet configured!");
  console.log(`  ID: ${spreadsheetId}`);
  console.log(`  URL: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
}

async function main() {
  const idArg = process.argv[2];
  const spreadsheetId = idArg ?? (await findSpreadsheetByName());

  if (!spreadsheetId) {
    console.error(
      "\nNo spreadsheet found. Create one manually in Impakt1_App:\n" +
        "  1. Open folder → New → Google Sheets\n" +
        "  2. Name it 'Ojas PT Tracker'\n" +
        "  3. Run: npx tsx scripts/populate-google-sheet.ts <spreadsheetId>\n"
    );
    process.exit(1);
  }

  await populate(spreadsheetId);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
