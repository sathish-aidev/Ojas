import { createClientWithPtSchema } from "@/lib/validations";

export async function parseClientCreateRequest(
  request: Request
): Promise<{ data: Record<string, unknown>; proofFile: File | null }> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const proof = form.get("proof");
    const proofFile =
      proof instanceof File && proof.size > 0 ? proof : null;

    const data: Record<string, unknown> = {};
    for (const [key, value] of form.entries()) {
      if (key === "proof") continue;
      if (typeof value === "string") data[key] = value;
    }
    return { data, proofFile };
  }

  const body = await request.json();
  return { data: body as Record<string, unknown>, proofFile: null };
}

export function validateClientCreate(data: Record<string, unknown>) {
  return createClientWithPtSchema.safeParse(data);
}
