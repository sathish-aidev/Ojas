import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { getMonthName } from "@/lib/permissions";
import { decimalToNumber } from "@/lib/utils";
import { generateTrainerReportPdf } from "@/lib/pdf/generate-trainer-report";
import { generatePayStubPdf } from "@/lib/pdf/generate-pay-stub";
import {
  getTrainerMonthlyReport,
  getTrainerMonthlyReportFromSnapshot,
} from "@/lib/services/trainer-monthly-report";
import { generatePayrollForGym, getSalariesOverview } from "@/lib/services/salaries";
import { syncAllTrainerTabs } from "@/lib/services/sheet-sync";
import {
  copySpreadsheetBackup,
  ensureReportsMonthFolder,
  getMonthFolderWebLink,
  uploadPdfToFolder,
} from "@/lib/google/drive-archive";
import { sendMonthlyReportEmail } from "@/lib/email/send-monthly-report";
import { getOwnerReportEmail } from "@/lib/sheet-config";

export type MonthlyCloseResult = {
  month: number;
  year: number;
  syncStatus: string;
  payrollCount: number;
  driveFolderUrl: string;
  emailSent: boolean;
  warnings: string[];
};

function slugName(name: string): string {
  return name.replace(/\s+/g, "-");
}

export async function runMonthlyClose(
  gymId: string,
  month: number,
  year: number,
  triggeredBy = "cron"
): Promise<MonthlyCloseResult> {
  const warnings: string[] = [];
  const gym = await prisma.gym.findUnique({ where: { id: gymId } });
  if (!gym) throw new Error("Gym not found");

  const { folderId } = await ensureReportsMonthFolder(month, year);

  try {
    await copySpreadsheetBackup(month, year, folderId);
  } catch (err) {
    warnings.push(
      `Sheet backup failed: ${err instanceof Error ? err.message : "unknown"}`
    );
  }

  const { summary: syncSummary } = await syncAllTrainerTabs(gymId, {
    triggeredBy,
    source: "CRON",
    month,
    year,
  });

  if (syncSummary.totalErrors > 0) {
    warnings.push(`Sync had ${syncSummary.totalErrors} error(s)`);
  }

  const payrollRuns = await generatePayrollForGym(gymId, month, year);
  const overview = await getSalariesOverview(gymId, month, year);

  const nonTrainerWithoutOverride = overview.filter(
    (row) =>
      row.employee.employeeType !== "TRAINER" &&
      !row.payroll
  );
  if (nonTrainerWithoutOverride.length > 0) {
    warnings.push(
      `Staff salary overrides missing for: ${nonTrainerWithoutOverride.map((r) => r.employee.user.name).join(", ")}`
    );
  }

  const zip = new JSZip();
  const monthLabel = `${getMonthName(month)}-${year}`;
  const pdfFiles: Array<{ name: string; buffer: Buffer }> = [];

  let totalPayroll = 0;
  let totalCommission = 0;

  for (const row of overview) {
    const payroll = payrollRuns.find((p) => p.employeeId === row.employee.id);
    if (!payroll) continue;

    totalPayroll += decimalToNumber(payroll.netPay);
    totalCommission += decimalToNumber(payroll.commission);

    if (row.employee.employeeType === "TRAINER") {
      const report = await getTrainerMonthlyReport(row.employee.id, month, year);
      if (report) {
        const reportPdf = await generateTrainerReportPdf(gym.name, report);
        const reportName = `PT-Report-${slugName(row.employee.user.name)}-${monthLabel}.pdf`;
        pdfFiles.push({ name: reportName, buffer: reportPdf });
        zip.file(reportName, reportPdf);
        await uploadPdfToFolder(folderId, reportName, reportPdf);
      }
    }

    let reportRows = undefined;
    const snapshot = await getTrainerMonthlyReportFromSnapshot(payroll.id);
    if (snapshot) {
      reportRows = snapshot.rows;
    } else if (row.employee.employeeType === "TRAINER") {
      const live = await getTrainerMonthlyReport(row.employee.id, month, year);
      reportRows = live?.rows;
    }

    const payStubPdf = await generatePayStubPdf({
      gymName: gym.name,
      employeeName: row.employee.user.name,
      employeeType: row.employee.employeeType,
      month,
      year,
      baseSalary: decimalToNumber(payroll.baseSalary),
      commission: decimalToNumber(payroll.commission),
      incentives: decimalToNumber(payroll.incentives),
      deductions: decimalToNumber(payroll.deductions),
      expenses: decimalToNumber(payroll.expenses),
      grossPay: decimalToNumber(payroll.grossPay),
      netPay: decimalToNumber(payroll.netPay),
      paidAt: payroll.paidAt,
      lineItems: payroll.lineItems.map((li) => ({
        label: li.label,
        amount: decimalToNumber(li.amount),
        isDeduction: li.isDeduction,
      })),
      reportRows,
    });

    const stubName = `PayStub-${slugName(row.employee.user.name)}-${monthLabel}.pdf`;
    pdfFiles.push({ name: stubName, buffer: payStubPdf });
    zip.file(stubName, payStubPdf);
    await uploadPdfToFolder(folderId, stubName, payStubPdf);
  }

  const zipName = `All-Reports-${monthLabel}.zip`;
  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
  await uploadPdfToFolder(folderId, zipName, zipBuffer);

  const driveFolderUrl = getMonthFolderWebLink(folderId);
  let emailSent = false;

  try {
    await sendMonthlyReportEmail({
      to: getOwnerReportEmail(),
      month,
      year,
      gymName: gym.name,
      driveFolderUrl,
      zipBuffer,
      zipFilename: zipName,
      summary: {
        syncStatus: syncSummary.status,
        rowsCreated: syncSummary.totalCreated,
        rowsUpdated: syncSummary.totalUpdated,
        totalPayroll,
        totalCommission,
        warnings,
      },
    });
    emailSent = true;
  } catch (err) {
    warnings.push(`Email failed: ${err instanceof Error ? err.message : "unknown"}`);
  }

  return {
    month,
    year,
    syncStatus: syncSummary.status,
    payrollCount: payrollRuns.length,
    driveFolderUrl,
    emailSent,
    warnings,
  };
}

export function getPreviousMonth(date = new Date()): { month: number; year: number } {
  const month = date.getMonth();
  const year = date.getFullYear();
  if (month === 0) return { month: 12, year: year - 1 };
  return { month, year };
}
