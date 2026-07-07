import { getMonthName } from "@/lib/permissions";
import { formatCurrency } from "@/lib/utils";

type EmailSummary = {
  syncStatus: string;
  rowsCreated: number;
  rowsUpdated: number;
  totalPayroll: number;
  totalCommission: number;
  warnings: string[];
};

export async function sendMonthlyReportEmail(params: {
  to: string;
  month: number;
  year: number;
  gymName: string;
  driveFolderUrl: string;
  zipBuffer: Buffer;
  zipFilename: string;
  summary: EmailSummary;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const monthLabel = `${getMonthName(params.month)} ${params.year}`;
  const warningBlock =
    params.summary.warnings.length > 0
      ? `\n\nWarnings:\n${params.summary.warnings.map((w) => `- ${w}`).join("\n")}`
      : "";

  const text = [
    `${params.gymName} — Monthly Close Report`,
    `Period: ${monthLabel}`,
    ``,
    `Sync: ${params.summary.syncStatus}`,
    `Rows created: ${params.summary.rowsCreated}`,
    `Rows updated: ${params.summary.rowsUpdated}`,
    `Total payroll: ${formatCurrency(params.summary.totalPayroll)}`,
    `Total PT commission: ${formatCurrency(params.summary.totalCommission)}`,
    ``,
    `Reports folder: ${params.driveFolderUrl}`,
    warningBlock,
  ].join("\n");

  const from = process.env.RESEND_FROM_EMAIL?.trim() || "onboarding@resend.dev";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: `${params.gymName} — ${monthLabel} Payroll & PT Reports`,
      text,
      attachments: [
        {
          filename: params.zipFilename,
          content: params.zipBuffer.toString("base64"),
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error (${res.status}): ${body}`);
  }

  return res.json();
}
