/**
 * Move Rent and Power Bill dates to the occupancy month (paid one month later).
 * Updates Date + Notes only. Does not delete rows or rewrite the sheet.
 *
 *   npx tsx scripts/shift-rent-power-to-occupancy.ts --prod
 *   npx tsx scripts/shift-rent-power-to-occupancy.ts --prod --apply
 */
import { config } from "dotenv";

const prod = process.argv.includes("--prod");
const apply = process.argv.includes("--apply");
config({ path: prod ? ".env.vercel.production" : ".env", override: true });

import { PrismaClient } from "@prisma/client";
import { getSheetsClient } from "../lib/google/sheets-client";
import { getExpensesSpreadsheetId, EXPENSES_TAB_NAME } from "../lib/sheet-config";
import { padValuesToA1 } from "../lib/google/sheet-grid";
import { parseExpenseCategory } from "../lib/revenue-constants";
import { parseSheetDate, formatDateDMY } from "../lib/import/parse-csv-dates";
import { addCalendarMonths } from "../lib/services/payment-allocation";
import { getMonthName } from "../lib/permissions";

const TARGET_CATEGORIES = new Set(["RENT", "POWER_BILL"]);
const PAID_NOTE = /Paid\s+(\d{1,2}\/\d{1,2}\/\d{4})/i;
const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

type Plan = {
  rowNumber: number;
  id: string;
  category: string;
  description: string;
  amount: string;
  payDate: Date;
  occupancyDate: Date;
  oldDateLabel: string;
  newDateLabel: string;
  oldNotes: string;
  newNotes: string;
  dateCol: number;
  notesCol: number;
  action: "shift" | "skip";
  reason: string;
};

function colIndex(header: string[], name: string) {
  return header.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
}

function cell(row: string[], idx: number) {
  return idx >= 0 ? (row[idx] ?? "").trim() : "";
}

function monthNamedInText(text: string): number | null {
  const lower = text.toLowerCase();
  for (let i = 0; i < MONTH_NAMES.length; i++) {
    if (new RegExp(`\\b${MONTH_NAMES[i]}\\b`).test(lower)) return i + 1;
  }
  return null;
}

function alreadyShifted(payDate: Date, occupancyDate: Date, notes: string): boolean {
  const match = notes.match(PAID_NOTE);
  if (!match) return false;
  const notedPaid = parseSheetDate(match[1]);
  if (!notedPaid) return false;
  return (
    formatDateDMY(notedPaid) === formatDateDMY(payDate) &&
    formatDateDMY(occupancyDate) === formatDateDMY(addCalendarMonths(payDate, -1))
  );
}

function buildNotes(existing: string, payDate: Date, occupancyDate: Date): string {
  const paid = `Paid ${formatDateDMY(payDate)}`;
  const forMonth = `For ${getMonthName(occupancyDate.getMonth() + 1)} ${occupancyDate.getFullYear()}`;
  const parts: string[] = [];
  const trimmed = existing.trim();
  if (trimmed && !PAID_NOTE.test(trimmed) && !/for\s+(january|february|march|april|may|june|july|august|september|october|november|december)/i.test(trimmed)) {
    parts.push(trimmed);
  } else if (trimmed) {
    const withoutPaid = trimmed
      .replace(PAID_NOTE, "")
      .replace(/for\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}/gi, "")
      .replace(/[.|]\s*$/, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (withoutPaid) parts.push(withoutPaid);
  }
  parts.push(`${paid}. ${forMonth}.`);
  return parts.join(" ").replace(/\s{2,}/g, " ").trim();
}

function colLetter(indexZeroBased: number) {
  return String.fromCharCode(65 + indexZeroBased);
}

async function main() {
  const spreadsheetId = getExpensesSpreadsheetId();
  const sheets = await getSheetsClient();
  const tab = EXPENSES_TAB_NAME;
  const range = `'${tab.replace(/'/g, "''")}'!A1:Z`;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "FORMATTED_VALUE",
  });
  const rows = padValuesToA1((res.data.values as unknown[][]) ?? [], res.data.range);
  const headerIdx = rows.findIndex((row) => {
    const cells = row.map((c) => (c ?? "").trim().toLowerCase());
    return cells.includes("date") && cells.includes("category") && cells.includes("amount");
  });
  if (headerIdx < 0) throw new Error("Expenses tab is missing Date/Category/Amount headers");

  const header = rows[headerIdx].map((h) => (h ?? "").trim());
  const idCol = colIndex(header, "Id");
  const dateCol = colIndex(header, "Date");
  const catCol = colIndex(header, "Category");
  const descCol = colIndex(header, "Description");
  const amtCol = colIndex(header, "Amount");
  const notesCol = colIndex(header, "Notes");
  if (dateCol < 0 || catCol < 0 || notesCol < 0) {
    throw new Error("Expenses tab needs Date, Category, and Notes columns");
  }

  const plans: Plan[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const category = parseExpenseCategory(cell(row, catCol));
    if (!category || !TARGET_CATEGORIES.has(category)) continue;

    const dateRaw = cell(row, dateCol);
    const payDate = parseSheetDate(dateRaw);
    const description = cell(row, descCol);
    const notes = cell(row, notesCol);
    const id = cell(row, idCol);
    const amount = cell(row, amtCol);
    const rowNumber = i + 1;

    if (!payDate) {
      plans.push({
        rowNumber,
        id,
        category,
        description,
        amount,
        payDate: new Date(0),
        occupancyDate: new Date(0),
        oldDateLabel: dateRaw,
        newDateLabel: dateRaw,
        oldNotes: notes,
        newNotes: notes,
        dateCol,
        notesCol,
        action: "skip",
        reason: "invalid date",
      });
      continue;
    }

    const occupancyDate = addCalendarMonths(payDate, -1);
    const namedMonth = monthNamedInText(`${description} ${notes}`);
    const payMonth = payDate.getMonth() + 1;
    const occMonth = occupancyDate.getMonth() + 1;

    let action: Plan["action"] = "shift";
    let reason = "payment date is one month after occupancy";

    if (alreadyShifted(payDate, occupancyDate, notes) && namedMonth === payMonth) {
      action = "skip";
      reason = "already on occupancy month (notes have Paid date)";
    } else if (namedMonth != null && namedMonth === payMonth) {
      action = "skip";
      reason = `description/notes already name ${getMonthName(namedMonth)} and Date is in that month`;
    } else if (namedMonth != null && namedMonth !== occMonth && namedMonth !== payMonth) {
      action = "skip";
      reason = `named month ${getMonthName(namedMonth)} does not match pay or occupancy — needs a look`;
    }

    const newNotes = action === "shift" ? buildNotes(notes, payDate, occupancyDate) : notes;
    plans.push({
      rowNumber,
      id,
      category,
      description,
      amount,
      payDate,
      occupancyDate,
      oldDateLabel: formatDateDMY(payDate),
      newDateLabel: formatDateDMY(occupancyDate),
      oldNotes: notes,
      newNotes,
      dateCol,
      notesCol,
      action,
      reason,
    });
  }

  console.log(prod ? "Target: production Expenses sheet" : "Target: local Expenses sheet");
  console.log(`Spreadsheet ${spreadsheetId} tab ${tab}`);
  console.log(`Found ${plans.length} Rent / Power Bill row(s)\n`);

  for (const plan of plans) {
    const tag = plan.action === "shift" ? "SHIFT" : "SKIP ";
    console.log(
      `${tag} row ${plan.rowNumber} ${plan.category} ${plan.oldDateLabel} → ${plan.newDateLabel}  ${plan.description}  ₹${plan.amount}`
    );
    console.log(`      ${plan.reason}`);
    if (plan.action === "shift") {
      console.log(`      notes: ${plan.newNotes}`);
    }
  }

  const toShift = plans.filter((p) => p.action === "shift");
  const skipped = plans.filter((p) => p.action === "skip");
  console.log(`\n${toShift.length} to shift, ${skipped.length} skipped`);

  if (!apply) {
    console.log("\nDry run. Pass --apply to update Date and Notes only (no rows deleted).");
    return;
  }

  const dataUpdates = toShift.map((plan) => ({
    range: `'${tab.replace(/'/g, "''")}'!${colLetter(plan.dateCol)}${plan.rowNumber}`,
    values: [[plan.newDateLabel]],
  }));
  const notesUpdates = toShift.map((plan) => ({
    range: `'${tab.replace(/'/g, "''")}'!${colLetter(plan.notesCol)}${plan.rowNumber}`,
    values: [[plan.newNotes]],
  }));

  if (toShift.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: [...dataUpdates, ...notesUpdates],
      },
    });
    console.log(`\nUpdated ${toShift.length} Date cell(s) and ${toShift.length} Notes cell(s).`);
  }

  const prisma = new PrismaClient();
  try {
    let dbUpdated = 0;
    for (const plan of toShift) {
      if (!plan.id) continue;
      const existing = await prisma.gymExpense.findFirst({ where: { id: plan.id } });
      if (!existing) {
        console.log(`  DB miss for sheet id ${plan.id} (row ${plan.rowNumber}) — sheet updated, DB skipped`);
        continue;
      }
      await prisma.gymExpense.update({
        where: { id: plan.id },
        data: {
          date: plan.occupancyDate,
          month: plan.occupancyDate.getMonth() + 1,
          year: plan.occupancyDate.getFullYear(),
          notes: plan.newNotes,
        },
      });
      dbUpdated += 1;
    }
    console.log(`Updated ${dbUpdated} matching database row(s). Did not rewrite or clear the sheet.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
