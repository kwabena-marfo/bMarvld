// Where a client gallery is up to, shared by the admin pages and the API.
export type GalleryStatus = "new" | "selecting" | "submitted" | "delivered" | "cleared";

export const galleryStatusLabels: Record<GalleryStatus, string> = {
  new: "Uploading proofs",
  selecting: "Client choosing",
  submitted: "Picks in, ready to edit",
  delivered: "Delivered",
  cleared: "Cleared",
};

// How long the delivery link stays open by default. When it closes, the
// gallery's photos are deleted from Cloudinary (see /api/cron/cleanup).
export const DELIVERY_DAYS = 7;
