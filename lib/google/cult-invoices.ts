import {
  CULT_INVOICES_FOLDER,
  CULT_SETTLEMENT_FOLDER,
  CULT_TAX_INVOICE_FOLDER,
  REPORTS_FOLDER_NAME,
  WEEKLY_BACKUPS_FOLDER,
  getDriveFolderId,
} from "@/lib/sheet-config";
import {
  downloadDriveFileBuffer,
  ensureCultInvoiceFolders,
  ensureFolder,
  listDriveChildren,
  searchDrivePdfsByName,
  type DriveFileMeta,
} from "@/lib/google/drive-archive";
import {
  classifyCultInvoiceName,
  parseCultInvoiceFilename,
  type CultInvoiceKind,
} from "@/lib/cult-invoice-parse";
import { parseCultPdfText, type ParsedCultPdf } from "@/lib/cult-pdf-parse";

export type CultDriveFile = {
  id: string;
  name: string;
  webViewLink: string;
  mimeType: string;
  kind: CultInvoiceKind;
  month: number | null;
  year: number | null;
  modifiedTime: string | null;
  folderHint: string;
};

const SKIP_FOLDERS = new Set(
  [REPORTS_FOLDER_NAME, WEEKLY_BACKUPS_FOLDER, "Backups"].map((n) => n.toLowerCase())
);

function isPdfOrDoc(file: DriveFileMeta) {
  const mime = file.mimeType.toLowerCase();
  const name = file.name.toLowerCase();
  return (
    mime.includes("pdf") ||
    name.endsWith(".pdf") ||
    mime.includes("image/") ||
    name.endsWith(".png") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg")
  );
}

function toCultFile(file: DriveFileMeta, folderHint: string): CultDriveFile {
  const parsed = parseCultInvoiceFilename(file.name, file.modifiedTime);
  return {
    id: file.id,
    name: file.name,
    webViewLink: file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`,
    mimeType: file.mimeType,
    kind: classifyCultInvoiceName(file.name),
    month: parsed.month,
    year: parsed.year,
    modifiedTime: file.modifiedTime,
    folderHint,
  };
}

async function collectFromFolder(
  folderId: string,
  folderHint: string,
  depth: number,
  into: Map<string, CultDriveFile>
) {
  const children = await listDriveChildren(folderId);
  for (const child of children) {
    if (child.mimeType === "application/vnd.google-apps.folder") {
      if (depth <= 0) continue;
      if (SKIP_FOLDERS.has(child.name.toLowerCase())) continue;
      await collectFromFolder(child.id, `${folderHint}/${child.name}`, depth - 1, into);
      continue;
    }
    if (!isPdfOrDoc(child)) continue;
    const kind = classifyCultInvoiceName(child.name);
    const inCultFolder = /cult|settlement|tax invoice/i.test(folderHint);
    if (!inCultFolder && kind === "unknown" && !/impackt|cult|curefit/i.test(child.name)) {
      continue;
    }
    if (!into.has(child.id)) into.set(child.id, toCultFile(child, folderHint));
  }
}

export async function listCultInvoiceFiles(): Promise<{
  folders: {
    cultInvoicesUrl: string;
    settlementUrl: string;
    taxInvoiceUrl: string;
  };
  files: CultDriveFile[];
}> {
  const folders = await ensureCultInvoiceFolders();
  const rootId = getDriveFolderId();
  const cultId = await ensureFolder(rootId, CULT_INVOICES_FOLDER);
  const settlementId = await ensureFolder(cultId, CULT_SETTLEMENT_FOLDER);
  const taxId = await ensureFolder(cultId, CULT_TAX_INVOICE_FOLDER);

  const byId = new Map<string, CultDriveFile>();
  await collectFromFolder(settlementId, CULT_SETTLEMENT_FOLDER, 2, byId);
  await collectFromFolder(taxId, CULT_TAX_INVOICE_FOLDER, 2, byId);
  await collectFromFolder(cultId, CULT_INVOICES_FOLDER, 2, byId);
  await collectFromFolder(rootId, "Gym Drive", 2, byId);

  try {
    const searched = await searchDrivePdfsByName([
      "Mnt End",
      "MntEnd",
      "Mnt",
      "Draft Settlement",
      "Settlement",
      "Invoice",
      "Impackt",
      "Gowlidoddi",
    ]);
    for (const file of searched) {
      if (!isPdfOrDoc(file) && file.mimeType !== "application/vnd.google-apps.folder") continue;
      if (file.mimeType === "application/vnd.google-apps.folder") continue;
      if (!byId.has(file.id)) byId.set(file.id, toCultFile(file, "Drive search"));
    }
  } catch {
    // Name search is best-effort; folder listing is enough when SA can see uploads.
  }

  const files = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  return { folders, files };
}

export async function parseCultPdfBuffer(
  buffer: Buffer | Uint8Array
): Promise<{ parsed: ParsedCultPdf; warning?: string }> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const extracted = await extractText(pdf, { mergePages: true });
  const text = Array.isArray(extracted.text) ? extracted.text.join("\n") : extracted.text;
  const parsed = parseCultPdfText(text ?? "");
  if (parsed.textLength < 40) {
    return {
      parsed,
      warning: "PDF has little or no selectable text (likely a scan). Linked as a record only.",
    };
  }
  return { parsed };
}

export async function extractCultPdfFigures(
  fileId: string
): Promise<{ parsed: ParsedCultPdf; warning?: string }> {
  const buffer = await downloadDriveFileBuffer(fileId);
  return parseCultPdfBuffer(buffer);
}

export function fileMatchesMonth(file: CultDriveFile, month: number, year: number) {
  return file.month === month && file.year === year;
}
