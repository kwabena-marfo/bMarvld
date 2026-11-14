import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export const uploadFolder = process.env.CLOUDINARY_UPLOAD_FOLDER ?? "bmarvld/gallery";

// Photos go straight from the admin's browser to Cloudinary (full-resolution
// files are far bigger than a serverless request body allows), authorised by
// this short-lived signature.
export function signUpload() {
  const timestamp = Math.round(Date.now() / 1000);
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder: uploadFolder },
    process.env.CLOUDINARY_API_SECRET!
  );
  return {
    timestamp,
    signature,
    folder: uploadFolder,
    apiKey: process.env.CLOUDINARY_API_KEY!,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
  };
}

// Looks the upload up on Cloudinary rather than trusting the dimensions and
// URL the browser reports back.
export async function getUploadedImage(publicId: string) {
  if (!publicId.startsWith(`${uploadFolder}/`)) return null;
  try {
    const res = await cloudinary.api.resource(publicId, { resource_type: "image" });
    return { url: res.secure_url as string, width: res.width as number, height: res.height as number };
  } catch {
    return null;
  }
}

export async function deleteImage(publicId: string) {
  await cloudinary.uploader.destroy(publicId, { resource_type: "image", invalidate: true });
}

// ------------------------------------------------------- client galleries ----
// Client proofs and finals are uploaded as "authenticated" assets: Cloudinary
// only serves them through URLs signed here, and the signature covers the
// transformation, so nobody can strip the watermark off a proof's URL or
// guess the address of an original.

export const clientsFolder = "bmarvld/clients";
// The logo laid over proofs; uploaded from public/brand by `npm run cloudinary:watermark`.
export const watermarkId = "bmarvld/brand/watermark";

export function signPrivateUpload(folder: string) {
  const timestamp = Math.round(Date.now() / 1000);
  const params = { timestamp, folder, type: "authenticated" };
  return {
    ...params,
    signature: cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET!),
    apiKey: process.env.CLOUDINARY_API_KEY!,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
  };
}

export async function getPrivateImage(publicId: string, folder: string) {
  if (!publicId.startsWith(`${folder}/`)) return null;
  try {
    const res = await cloudinary.api.resource(publicId, { resource_type: "image", type: "authenticated" });
    return { width: res.width as number, height: res.height as number };
  } catch {
    return null;
  }
}

export function privateImageUrl(publicId: string, { width, watermark = false }: { width: number; watermark?: boolean }) {
  return cloudinary.url(publicId, {
    type: "authenticated",
    sign_url: true,
    transformation: [
      { width, height: width, crop: "limit", quality: "auto", fetch_format: "auto" },
      ...(watermark
        ? [
            // A small logo repeated over the whole photo, so cropping can't remove it.
            { overlay: watermarkId.replaceAll("/", ":"), width: 0.3, flags: ["relative", "tiled"], opacity: 22 },
          ]
        : []),
    ],
  });
}

// The untouched original, served as a download with the given file name.
export function privateDownloadUrl(publicId: string, filename: string) {
  const name = filename.replace(/\.[^.]+$/, "").replace(/[^\w\- ]+/g, "_") || "photo";
  return cloudinary.url(publicId, { type: "authenticated", sign_url: true, flags: `attachment:${name}` });
}

// A short-lived link that has Cloudinary zip the originals up on the fly. Files
// keep the names they were uploaded with (IMG_4021.jpg), not their random ids.
export function privateZipUrl(publicIds: string[], name: string) {
  return cloudinary.utils.download_zip_url({
    public_ids: publicIds,
    resource_type: "image",
    type: "authenticated",
    flatten_folders: true,
    use_original_filename: true,
    target_public_id: name.replace(/[^\w\- ]+/g, "_"),
    expires_at: Math.round(Date.now() / 1000) + 60 * 60,
  });
}

// ------------------------------------------------------ client favourites ----
// When a client features one of their edits on the site, a public copy is made
// in its own folder, so it stays up after their private gallery is cleared.

export const featuredFolder = "bmarvld/featured";

export async function publishPrivateImage(publicId: string) {
  // Cloudinary fetches this signed address itself; 2400 px is plenty for the site.
  const source = cloudinary.url(publicId, {
    type: "authenticated",
    sign_url: true,
    format: "jpg",
    transformation: [{ width: 2400, height: 2400, crop: "limit", quality: 90 }],
  });
  const res = await cloudinary.uploader.upload(source, { folder: featuredFolder, resource_type: "image" });
  return { publicId: res.public_id, width: res.width, height: res.height };
}

/** A public photo at a given width, in the best format for the visitor's browser. */
export function publicImageUrl(publicId: string, width: number) {
  return cloudinary.url(publicId, {
    transformation: [{ width, height: width, crop: "limit", quality: "auto", fetch_format: "auto" }],
  });
}

export async function deletePrivateFolder(folder: string) {
  await cloudinary.api.delete_resources_by_prefix(`${folder}/`, { resource_type: "image", type: "authenticated" });
  await cloudinary.api.delete_folder(folder).catch(() => {}); // fine if it was never created
}

export async function deletePrivateImage(publicId: string) {
  await cloudinary.uploader.destroy(publicId, { resource_type: "image", type: "authenticated", invalidate: true });
}
