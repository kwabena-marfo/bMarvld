import { connection } from "next/server";
import Gallery from "./Gallery";
import { portfolio } from "@/data/gallery";
import { listPhotos } from "@/lib/photos";

// Read fresh on every visit so uploads from /admin/gallery show immediately,
// newest first, ahead of the bundled portfolio.
export default async function GallerySection() {
  await connection();
  const photos = await listPhotos().catch((err) => {
    console.error("Could not load gallery:", err);
    return [];
  });
  return <Gallery shots={[...photos, ...portfolio]} />;
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
