import { writeFile, mkdir } from "fs/promises";
import path from "path";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

export async function saveUploadedImage(
  file: File,
  subfolder?: "payments" | "progress"
): Promise<string> {
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error("Invalid file type. Use JPEG, PNG, or WebP.");
  }

  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) {
    throw new Error("File too large. Maximum size is 5 MB.");
  }

  const buffer = Buffer.from(bytes);
  const uploadsDir = subfolder
    ? path.join(process.cwd(), "public", "uploads", subfolder)
    : path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${Date.now()}-${safeName}`;
  await writeFile(path.join(uploadsDir, filename), buffer);

  return subfolder ? `/uploads/${subfolder}/${filename}` : `/uploads/${filename}`;
}
