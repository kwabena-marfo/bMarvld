import { connection } from "next/server";
import FeaturedGallery from "./FeaturedGallery";
import SectionHeading from "./SectionHeading";
import { listFeatured } from "@/lib/featured";

// "Client favourites": edited photos clients starred on their delivery page.
// Read on every visit, so a photo shows up as soon as the client stars it.
export default async function ClientFavourites() {
  await connection();
  const photos = await listFeatured().catch((err) => {
    console.error("Could not load client favourites:", err);
    return [];
  });
  if (!photos.length) return null;

  return (
    <section
      id="favourites"
      className="mx-auto max-w-384 scroll-mt-16 border-t border-cream/10 px-4 py-24 sm:px-6 lg:px-10"
    >
      <SectionHeading eyebrow="Loved by our clients" title="Client favourites" />
      <p className="mx-auto -mt-6 mb-12 max-w-md text-center text-sm text-cream-dim">
        Each of these was picked by the client as a favourite from their own shoot.
      </p>
      <FeaturedGallery photos={photos} />
    </section>
  );
}
