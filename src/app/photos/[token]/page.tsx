import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import ClientGalleryShell, { GalleryHeading, LinkClosed } from "@/components/ClientGalleryShell";
import FinalGallery from "@/components/FinalGallery";
import { GallerySkeleton } from "@/components/GallerySection";
import { getFinalGallery } from "@/lib/clientGalleries";
import { formatDate } from "@/lib/formatDate";

export const metadata: Metadata = {
  title: "Your photos",
  robots: { index: false, follow: false },
};

// The link a client gets once their edited photos are ready.
export default function PhotosPage({ params }: PageProps<"/photos/[token]">) {
  return (
    <ClientGalleryShell>
      <Suspense fallback={<GallerySkeleton />}>
        <Photos params={params} />
      </Suspense>
    </ClientGalleryShell>
  );
}

async function Photos({ params }: Pick<PageProps<"/photos/[token]">, "params">) {
  await connection(); // the link's expiry is checked against the current time
  const { token } = await params;
  const gallery = await getFinalGallery(token);
  if (!gallery) return <LinkClosed />;
  if (gallery.expired) return <LinkClosed clientName={gallery.clientName} />;

  return (
    <>
      <GalleryHeading eyebrow={gallery.title} title={`${gallery.clientName.split(" ")[0]}, your photos are ready`}>
        Please download them by {formatDate(gallery.expiresAt)}. After that this link closes and the photos are
        removed from our gallery. ...be marveled
      </GalleryHeading>
      <FinalGallery
        token={token}
        photos={gallery.photos}
        featured={gallery.featured}
        maxFeatured={gallery.maxFeatured}
      />
    </>
  );
}
