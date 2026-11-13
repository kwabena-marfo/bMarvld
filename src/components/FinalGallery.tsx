"use client";

import { DownloadIcon } from "lucide-react";
import { useState } from "react";
import ClientPhotoTile from "./ClientPhotoTile";
import PhotoLightbox from "./PhotoLightbox";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Final = { id: string; width: number; height: number; thumb: string; full: string; download: string };

// The client's finished photos: browse, then download one at a time or all at once.
export default function FinalGallery({ token, photos }: { token: string; photos: Final[] }) {
  const [open, setOpen] = useState<number | null>(null);

  const download = (p: Final, size: "sm" | "lg") => (
    <a
      href={p.download}
      onClick={(e) => e.stopPropagation()}
      aria-label="Download this photo"
      className={cn(
        size === "sm"
          ? "absolute top-2 right-2 rounded-full bg-ink/60 p-2 text-cream backdrop-blur-sm hover:text-gold"
          : buttonVariants({ size: "lg" })
      )}
    >
      <DownloadIcon className="size-4" />
      {size === "lg" && "Download"}
    </a>
  );

  return (
    <>
      <div className="mb-8 text-center">
        {/* A plain link: the API redirects to a zip Cloudinary builds on the fly. */}
        <a href={`/api/photos/${token}/zip`} className={buttonVariants({ size: "lg" })}>
          <DownloadIcon /> Download all ({photos.length})
        </a>
        <p className="mt-2 text-xs text-cream-dim">Full-size files. The zip can take a moment to start.</p>
      </div>

      <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
        {photos.map((p, i) => (
          <ClientPhotoTile
            key={p.id}
            src={p.thumb}
            width={p.width}
            height={p.height}
            label={`View photo ${i + 1}`}
            onOpen={() => setOpen(i)}
          >
            {download(p, "sm")}
          </ClientPhotoTile>
        ))}
      </div>

      <PhotoLightbox photos={photos} index={open} onIndex={setOpen} actions={(p) => download(p, "lg")} />
    </>
  );
}
