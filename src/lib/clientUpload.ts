import { sendJson } from "./forms";

type Signature = { timestamp: number; signature: string; folder: string; type: string; apiKey: string; cloudName: string };
export type PhotoKind = "proofs" | "finals";

// Photos go up at full size, so the admin can download the client's picks at
// full quality; clients only ever see resized, watermarked copies of proofs.
// Cloudinary's plan takes up to 10 MB a photo: a bigger proof is scaled down
// to fit, and a bigger edit is refused with a clear message rather than being
// quietly delivered at lower quality.
const MAX_BYTES = 10 * 1024 * 1024;
const FALLBACK_EDGE = 4096;

async function shrink(file: File) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, FALLBACK_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) throw new Error("Couldn't read this image");
  return blob;
}

// Browser → Cloudinary directly (signed by our API, as a private asset), then
// registered with the client's gallery.
export async function uploadClientPhoto(galleryId: string, kind: PhotoKind, file: File) {
  const tooBig = file.size > MAX_BYTES;
  if (tooBig && kind === "finals") {
    throw new Error(`${(file.size / 1024 / 1024).toFixed(1)} MB — export it under 10 MB`);
  }
  const base = `/api/admin/clients/${galleryId}/${kind}`;
  const [sig, body] = await Promise.all([sendJson<Signature>(`${base}/sign`), tooBig ? shrink(file) : file]);

  const form = new FormData();
  form.append("file", body, file.name);
  form.append("api_key", sig.apiKey);
  form.append("timestamp", String(sig.timestamp));
  form.append("folder", sig.folder);
  form.append("type", sig.type);
  form.append("signature", sig.signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? "Upload failed");

  await sendJson(base, { publicId: data.public_id, name: file.name });
}
