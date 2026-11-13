import { sendJson } from "./forms";

type Signature = { timestamp: number; signature: string; folder: string; type: string; apiKey: string; cloudName: string };
export type PhotoKind = "proofs" | "finals";

// Proofs only need to be big enough to choose from, so they're shrunk in the
// browser first: the full-resolution original never leaves the admin's
// computer, and uploads are quick and stay under Cloudinary's size limit.
const PROOF_EDGE = 2048;

async function shrink(file: File) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, PROOF_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("Couldn't read this image");
  return blob;
}

// Browser → Cloudinary directly (signed by our API, as a private asset), then
// registered with the client's gallery.
export async function uploadClientPhoto(galleryId: string, kind: PhotoKind, file: File) {
  const base = `/api/admin/clients/${galleryId}/${kind}`;
  const [sig, body] = await Promise.all([
    sendJson<Signature>(`${base}/sign`),
    kind === "proofs" ? shrink(file) : Promise.resolve(file),
  ]);

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
