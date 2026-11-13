"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import LogoLoader from "./LogoLoader";
import { cn } from "@/lib/utils";

export type LightboxPhoto = { id: string; full: string; width: number; height: number };

// Full-screen viewer for a client's gallery, stepping with the arrows or the
// keyboard. Photos come pre-sized from Cloudinary, so Next doesn't resize them.
export default function PhotoLightbox<T extends LightboxPhoto>({
  photos,
  index,
  onIndex,
  actions,
}: {
  photos: T[];
  index: number | null;
  onIndex: (index: number | null) => void;
  actions?: (photo: T) => React.ReactNode;
}) {
  const count = photos.length;

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onIndex(null);
      if (e.key === "ArrowRight") onIndex((index + 1) % count);
      if (e.key === "ArrowLeft") onIndex((index - 1 + count) % count);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, count, onIndex]);

  if (index === null || !photos[index]) return null;
  const photo = photos[index];
  const neighbours = count > 1 ? [...new Set([(index + 1) % count, (index - 1 + count) % count])].filter((i) => i !== index) : [];

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex flex-col bg-ink/95" onClick={() => onIndex(null)}>
      <div className="flex items-center justify-between gap-4 p-4 text-sm text-cream-dim">
        <span>
          {index + 1} / {count}
        </span>
        <button onClick={() => onIndex(null)} className="p-2 tracking-[0.2em] text-cream uppercase">
          Close ✕
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-12 sm:px-16">
        <div className="viewfinder relative max-h-full p-4 text-cream/70 sm:p-6" onClick={(e) => e.stopPropagation()}>
          {/* Keyed by photo, so stepping drops the old one at once and shows the loader. */}
          <Frame key={photo.id} photo={photo} />
        </div>
        {count > 1 && (
          <>
            <Arrow label="Previous photo" className="left-1" onClick={() => onIndex((index - 1 + count) % count)}>
              ‹
            </Arrow>
            <Arrow label="Next photo" className="right-1" onClick={() => onIndex((index + 1) % count)}>
              ›
            </Arrow>
          </>
        )}
      </div>
      <div className="flex min-h-16 items-center justify-center gap-3 p-4" onClick={(e) => e.stopPropagation()}>
        {actions?.(photo)}
      </div>
      {neighbours.map((i) => (
        <Image
          key={photos[i].id}
          src={photos[i].full}
          alt=""
          aria-hidden
          width={photos[i].width}
          height={photos[i].height}
          unoptimized
          loading="eager"
          className="hidden"
        />
      ))}
    </div>
  );
}

function Frame({ photo }: { photo: LightboxPhoto }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      <Image
        src={photo.full}
        alt=""
        width={photo.width}
        height={photo.height}
        unoptimized
        draggable={false}
        onContextMenu={(e) => e.preventDefault()}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={cn(
          "max-h-[calc(100svh-11rem)] w-auto object-contain transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0"
        )}
      />
      {!loaded && (
        <span className="absolute inset-0 flex items-center justify-center">
          <LogoLoader label="Loading photo" className="size-14" />
        </span>
      )}
    </>
  );
}

function Arrow({ label, className, onClick, children }: { label: string; className: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn("absolute top-1/2 -translate-y-1/2 p-3 text-4xl text-cream/70 hover:text-gold", className)}
      aria-label={label}
    >
      {children}
    </button>
  );
}
