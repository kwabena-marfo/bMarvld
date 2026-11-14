import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import ClientGalleryShell, { GalleryHeading, LinkClosed } from "@/components/ClientGalleryShell";
import { GallerySkeleton } from "@/components/GallerySection";
import ProofSelector from "@/components/ProofSelector";
import { getProofGallery } from "@/lib/clientGalleries";
import { formatDate } from "@/lib/formatDate";

export const metadata: Metadata = {
  title: "Choose your photos",
  robots: { index: false, follow: false },
};

// The temporary link a client gets to pick their favourite proofs.
export default function ProofsPage({ params }: PageProps<"/proofs/[token]">) {
  return (
    <ClientGalleryShell>
      <Suspense fallback={<GallerySkeleton />}>
        <Proofs params={params} />
      </Suspense>
    </ClientGalleryShell>
  );
}

async function Proofs({ params }: Pick<PageProps<"/proofs/[token]">, "params">) {
  await connection(); // the link's expiry is checked against the current time
  const { token } = await params;
  const gallery = await getProofGallery(token);
  if (!gallery) return <LinkClosed />;
  if (gallery.expired) return <LinkClosed clientName={gallery.clientName} />;

  const pick = gallery.maxSelections ? `up to ${gallery.maxSelections} favourites` : "your favourites";
  return (
    <>
      <GalleryHeading eyebrow={gallery.title} title={`Hi ${gallery.clientName.split(" ")[0]}, choose your photos`}>
        Tap the heart on {pick}, then send your selection and we&apos;ll edit them for you. These previews carry a
        watermark, but your edited photos won&apos;t. Open until {formatDate(gallery.expiresAt)}.
      </GalleryHeading>
      <ProofSelector
        token={token}
        photos={gallery.photos}
        initialSelected={gallery.selected}
        maxSelections={gallery.maxSelections}
        initiallySubmitted={gallery.submitted}
      />
    </>
  );
}
