// Uploads the logo that's laid over client proofs (see privateImageUrl in
// src/lib/cloudinary.ts). Run once per Cloudinary account, and again whenever
// the logo artwork changes:
//
//   npm run cloudinary:watermark
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const res = await cloudinary.uploader.upload("public/brand/mark-cream.png", {
  public_id: "bmarvld/brand/watermark",
  overwrite: true,
  invalidate: true,
});
console.log(`Uploaded ${res.public_id} (${res.width}×${res.height}) to ${process.env.CLOUDINARY_CLOUD_NAME}.`);
