import { pdf } from "@react-pdf/renderer";
import { TrainerReportDocument } from "@/lib/pdf/trainer-report";
import type { TrainerMonthlyReport } from "@/lib/services/trainer-monthly-report";

export async function generateTrainerReportPdf(
  gymName: string,
  report: TrainerMonthlyReport
): Promise<Buffer> {
  const instance = pdf(TrainerReportDocument({ gymName, report }));
  const blob = await instance.toBlob();
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
