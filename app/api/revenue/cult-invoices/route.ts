import {
  getApiUser,
  unauthorized,
  forbidden,
  badRequest,
  ok,
} from "@/lib/api-utils";
import { canManageCultSettlements } from "@/lib/permissions";
import { listCultInvoiceFiles } from "@/lib/google/cult-invoices";
import {
  attachCultFileToMonth,
  ingestCultInvoicePdf,
  scanCultInvoicesFromDrive,
} from "@/lib/services/cult-drive-sync";

export const maxDuration = 60;

export async function GET() {
  const user = await getApiUser();
  if (!user) return unauthorized();
  if (!canManageCultSettlements(user.role)) return forbidden();

  try {
    const result = await listCultInvoiceFiles();
    return ok(result);
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : "Could not list Drive invoices");
  }
}

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  if (!canManageCultSettlements(user.role)) return forbidden();

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    try {
      const form = await request.formData();
      const file = form.get("file");
      const month = Number(form.get("month"));
      const year = Number(form.get("year"));
      const kind = form.get("kind") === "tax_invoice" ? "tax_invoice" : "settlement";
      if (!(file instanceof File)) return badRequest("PDF file is required");
      if (!month || !year) return badRequest("month and year are required");
      const confirm = String(form.get("confirm") ?? "") === "true";
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await ingestCultInvoicePdf(
        user.gymId,
        user.id,
        month,
        year,
        file.name || (kind === "tax_invoice" ? "cult-tax-invoice.pdf" : "cult-settlement.pdf"),
        buffer,
        kind,
        { confirm }
      );
      return ok(result);
    } catch (err) {
      return badRequest(err instanceof Error ? err.message : "Could not read invoice PDF");
    }
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    fileId?: string;
    fileName?: string;
    webViewLink?: string;
    mimeType?: string;
    kind?: "settlement" | "tax_invoice" | "unknown";
    month?: number;
    year?: number;
    parsePdfs?: boolean;
  };

  try {
    if (body.action === "attach") {
      if (!body.fileId || !body.webViewLink || !body.month || !body.year) {
        return badRequest("fileId, webViewLink, month, and year are required");
      }
      const result = await attachCultFileToMonth(
        user.gymId,
        user.id,
        {
          id: body.fileId,
          name: body.fileName ?? body.fileId,
          webViewLink: body.webViewLink,
          mimeType: body.mimeType ?? "application/pdf",
          kind: body.kind ?? "unknown",
          month: body.month,
          year: body.year,
          modifiedTime: null,
          folderHint: "manual",
        },
        body.month,
        body.year,
        body.kind
      );
      return ok(result);
    }

    const result = await scanCultInvoicesFromDrive(user.gymId, user.id, {
      parsePdfs: body.parsePdfs === true,
    });
    return ok(result);
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : "Drive scan failed");
  }
}
