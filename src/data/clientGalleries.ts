// Where a client gallery is up to, shared by the admin pages and the API.
export type GalleryStatus = "new" | "selecting" | "submitted" | "delivered";

export const galleryStatusLabels: Record<GalleryStatus, string> = {
  new: "Uploading proofs",
  selecting: "Client choosing",
  submitted: "Selection in — edit",
  delivered: "Delivered",
};
