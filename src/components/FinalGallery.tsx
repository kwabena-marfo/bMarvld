"use client";

import { DownloadIcon, StarIcon } from "lucide-react";
import { useState } from "react";
import ClientPhotoTile from "./ClientPhotoTile";
import PhotoLightbox from "./PhotoLightbox";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Final = { id: string; width: number; height: number; thumb: string; full: string; download: string };

// The client's finished photos: browse, download one at a time or all at once,
// and star up to `maxFeatured` to be featured on the B.Marvld site.
export default function FinalGallery({
  token,
  photos,
  featured: initialFeatured,
  maxFeatured,
}: {
  token: string;
  photos: Final[];
  featured: string[];
  maxFeatured: number;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [featured, setFeatured] = useState(() => new Set(initialFeatured));
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");

  async function toggleFeatured(photo: Final) {
    if (busy.has(photo.id)) return;
    const feature = !featured.has(photo.id);
    if (feature && featured.size >= maxFeatured) {
      setMessage(`You can feature ${maxFeatured} photos. Tap a starred one to swap it.`);
      return;
    }
    setMessage("");
    setBusy((b) => new Set(b).add(photo.id));
    try {
      const res = await fetch(`/api/photos/${token}/feature`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId: photo.id, featured: feature }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't save that. Please try again.");
      setFeatured(new Set(data.featured as string[]));
      setMessage(feature ? "Thank you! It's now on our website." : "Removed from our website.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Couldn't save that. Please try again.");
    } finally {
      setBusy((b) => {
        const next = new Set(b);
        next.delete(photo.id);
        return next;
      });
    }
  }

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

  const star = (p: Final, size: "sm" | "lg") => {
    const on = featured.has(p.id);
    const label = on ? "Remove from the B.Marvld website" : "Feature on the B.Marvld website";
    const icon = <StarIcon className={cn("size-4", on && "fill-gold text-gold", busy.has(p.id) && "animate-pulse")} />;
    return size === "sm" ? (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggleFeatured(p);
        }}
        aria-label={label}
        aria-pressed={on}
        className="absolute top-2 left-2 rounded-full bg-ink/60 p-2 text-cream backdrop-blur-sm hover:text-gold"
      >
        {icon}
      </button>
    ) : (
      <Button size="lg" variant="outline" onClick={() => toggleFeatured(p)} aria-pressed={on}>
        {icon}
        {on ? "Featured" : "Feature on our site"}
      </Button>
    );
  };

  return (
    <>
      <div className="mb-8 text-center">
        {/* A plain link: the API redirects to a zip Cloudinary builds on the fly. */}
        <a href={`/api/photos/${token}/zip`} className={buttonVariants({ size: "lg" })}>
          <DownloadIcon /> Download all ({photos.length})
        </a>
        <p className="mt-2 text-xs text-cream-dim">Full-size files. The zip can take a moment to start.</p>
      </div>

      <div className="mx-auto mb-8 max-w-xl border border-gold/30 bg-gold/5 p-4 text-center text-sm">
        <p>
          <StarIcon className="mr-1 mb-0.5 inline size-4 fill-gold text-gold" />
          Love some of these? Star up to {maxFeatured} to have them featured on our website.
        </p>
        <p className="mt-1 text-xs text-cream-dim" aria-live="polite">
          {message || `${featured.size} of ${maxFeatured} chosen. They go live straight away, and you can change your mind while this link is open.`}
        </p>
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
            className={cn(featured.has(p.id) && "ring-2 ring-gold")}
          >
            {star(p, "sm")}
            {download(p, "sm")}
          </ClientPhotoTile>
        ))}
      </div>

      <PhotoLightbox
        photos={photos}
        index={open}
        onIndex={setOpen}
        actions={(p) => (
          <div className="flex flex-wrap justify-center gap-3">
            {star(p, "lg")}
            {download(p, "lg")}
          </div>
        )}
      />
    </>
  );
}
