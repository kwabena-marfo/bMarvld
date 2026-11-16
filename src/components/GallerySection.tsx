import { connection } from "next/server";
import Gallery from "./Gallery";
import { listPhotos } from "@/lib/photos";

// The portfolio is whatever's uploaded in /admin/gallery, newest first. Read
// fresh on every visit, so uploads and deletions show immediately.
export default async function GallerySection() {
  await connection();
  const photos = await listPhotos().catch((err) => {
    console.error("Could not load gallery:", err);
    return [];
  });
  if (!photos.length) {
    return <p className="text-center text-cream-dim">New work is on the way. Check back soon.</p>;
  }
  return <Gallery shots={photos} />;
}

export function GallerySkeleton() {
  return (
    <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
      {[1.3, 0.7, 1.2, 0.7, 1.4, 0.8, 1.1, 0.9].map((ratio, i) => (
        <div key={i} className="mb-4 animate-pulse bg-cream/5" style={{ aspectRatio: `1 / ${ratio}` }} />
      ))}
    </div>
  );
}
