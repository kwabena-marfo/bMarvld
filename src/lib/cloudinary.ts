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
