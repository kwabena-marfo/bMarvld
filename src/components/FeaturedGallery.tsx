"use client";

import { useState } from "react";
import ClientPhotoTile from "./ClientPhotoTile";
import PhotoLightbox from "./PhotoLightbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Featured = { id: string; width: number; height: number; thumb: string; full: string };

const STEP = 8;

export default function FeaturedGallery({ photos }: { photos: Featured[] }) {
  const [shown, setShown] = useState(STEP);
  const [open, setOpen] = useState<number | null>(null);
  const visible = photos.slice(0, shown);
  // With only a few photos, fewer, centred columns, so they don't huddle to one side.
  const cols = Math.min(photos.length, 4);

  return (
    <>
      <div
        className={cn(
          "mx-auto gap-3",
          cols === 1 ? "columns-1" : "columns-2",
          cols >= 3 && "sm:columns-3",
          cols >= 4 && "lg:columns-4"
        )}
        style={{ maxWidth: `${cols * 22}rem` }}
      >
        {visible.map((p, i) => (
          <ClientPhotoTile
            key={p.id}
            src={p.thumb}
            width={p.width}
            height={p.height}
            label={`View client favourite ${i + 1}`}
            onOpen={() => setOpen(i)}
          />
        ))}
      </div>
      {shown < photos.length && (
        <div className="mt-10 text-center">
          <Button variant="outline" size="lg" onClick={() => setShown((n) => n + STEP)}>
            Show more
          </Button>
        </div>
      )}
      <PhotoLightbox photos={visible} index={open} onIndex={setOpen} />
    </>
  );
}
