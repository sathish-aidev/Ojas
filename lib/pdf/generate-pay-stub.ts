import { pdf } from "@react-pdf/renderer";
import { PayStubDocument, type PayStubProps } from "@/lib/pdf/pay-stub";

export async function generatePayStubPdf(props: PayStubProps): Promise<Buffer> {
  const instance = pdf(PayStubDocument(props));
  const blob = await instance.toBlob();
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
