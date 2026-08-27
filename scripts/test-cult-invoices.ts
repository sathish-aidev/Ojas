/**
 * Cult invoice naming / Drive matching — run after invoice ingest changes:
 *   npm run test:cult-invoices
 */
import {
  classifyCultInvoice,
  cultInvoiceCanonicalName,
  DEFAULT_CULT_GYM_LABEL,
  driveFileIdFromUrl,
  parseCultInvoiceFilename,
} from "../lib/cult-invoice-parse";
import { isNewCultDriveFile } from "../lib/services/cult-drive-sync";
import type { CultDriveFile } from "../lib/google/cult-invoices";
import type { CultSettlement } from "@prisma/client";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

function file(partial: Partial<CultDriveFile> & Pick<CultDriveFile, "id" | "name">): CultDriveFile {
  return {
    webViewLink: `https://drive.google.com/file/d/${partial.id}/view`,
    mimeType: "application/pdf",
    kind: "settlement",
    month: 4,
    year: 2026,
    modifiedTime: null,
    folderHint: "Settlement_Statements",
    ...partial,
  };
}

function main() {
  console.log("\n=== Cult invoice Drive names ===\n");

  const settlement = cultInvoiceCanonicalName("settlement", 4, 2026);
  const tax = cultInvoiceCanonicalName("tax_invoice", 4, 2026);
  assert(
    settlement === `${DEFAULT_CULT_GYM_LABEL}_Apr'26_Mnt End.pdf`,
    "April settlement name"
  );
  assert(
    tax === `${DEFAULT_CULT_GYM_LABEL}_Apr2026_Tax Invoice.pdf`,
    "April tax invoice name"
  );
  assert(
    cultInvoiceCanonicalName("settlement", 12, 2025) ===
      `${DEFAULT_CULT_GYM_LABEL}_Dec'25_Mnt End.pdf`,
    "December settlement name"
  );

  const fromSettlement = parseCultInvoiceFilename(settlement);
  assert(fromSettlement.month === 4 && fromSettlement.year === 2026, "Parse Apr'26 Mnt End");
  const fromTax = parseCultInvoiceFilename(tax);
  assert(fromTax.month === 4 && fromTax.year === 2026, "Parse Apr2026 Tax Invoice");

  assert(classifyCultInvoice(settlement) === "settlement", "Classify settlement filename");
  assert(classifyCultInvoice(tax) === "tax_invoice", "Classify tax invoice filename");
  assert(
    classifyCultInvoice("random.pdf", "Tax_Invoices") === "tax_invoice",
    "Folder Tax_Invoices wins"
  );
  assert(
    classifyCultInvoice("random.pdf", "Settlement_Statements") === "settlement",
    "Folder Settlement_Statements wins"
  );

  assert(
    driveFileIdFromUrl("https://drive.google.com/file/d/abc123XYZ/view") === "abc123XYZ",
    "Drive file id from URL"
  );
  assert(
    isNewCultDriveFile(
      file({ id: "new-id", name: settlement }),
      { settlementDriveUrl: "https://drive.google.com/file/d/old-id/view" } as CultSettlement,
      "settlement"
    ),
    "New Drive file is treated as new"
  );
  assert(
    !isNewCultDriveFile(
      file({
        id: "same-id",
        name: settlement,
        webViewLink: "https://drive.google.com/file/d/same-id/view",
      }),
      { settlementDriveUrl: "https://drive.google.com/file/d/same-id/view" } as CultSettlement,
      "settlement"
    ),
    "Already-linked Drive file is not new"
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main();
