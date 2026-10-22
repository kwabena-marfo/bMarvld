"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { photoCategories, type Shot } from "@/data/gallery";

const PAGE = 12;

export default function Gallery({ shots }: { shots: Shot[] }) {
  const [filter, setFilter] = useState("All");
  const [limit, setLimit] = useState(PAGE);
  // Only offer categories that actually have photos.
  const categories = ["All", ...photoCategories.filter((cat) => shots.some((s) => s.category === cat))];
  const [open, setOpen] = useState<number | null>(null);

  // The lightbox steps through every photo in the filter, not just those shown.
  const visible = filter === "All" ? shots : shots.filter((s) => s.category === filter);
  const shown = visible.slice(0, limit);
  const step = (n: number) => setOpen((i) => (i! + n + visible.length) % visible.length);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((i) => (i! + 1) % visible.length);
      if (e.key === "ArrowLeft") setOpen((i) => (i! - 1 + visible.length) % visible.length);    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, visible.length]);

  const current = open !== null ? visible[open] : null;

  return (
    <>
      <div className="mb-10 flex flex-wrap justify-center gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => {
              setFilter(cat);
              setLimit(PAGE);
            }}
            className={`px-4 py-2 text-xs tracking-[0.2em] uppercase transition ${
              filter === cat ? "bg-cream text-ink" : "border border-cream/20 text-cream-dim hover:border-cream/60"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
        {shown.map((shot, i) => (
          <button
            key={shot.id ?? shot.src}
            onClick={() => setOpen(i)}
            className="group relative mb-4 block w-full overflow-hidden break-inside-avoid"
          >
            <Image
              src={shot.src}
              alt={shot.alt}
              width={shot.width}
              height={shot.height}
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="h-auto w-full transition duration-700 group-hover:scale-105"
            />
            <span className="absolute inset-0 flex items-end bg-linear-to-t from-ink/80 via-transparent p-4 opacity-0 transition group-hover:opacity-100">
              <span className="text-xs tracking-[0.25em] text-cream uppercase">
                <span className="text-gold">●</span> {shot.category}
              </span>
            </span>
          </button>
        ))}
      </div>

      {visible.length > limit && (
        <div className="mt-8 text-center">
          <button
            onClick={() => setLimit((l) => l + PAGE)}
            className="border border-cream/30 px-8 py-3 text-xs tracking-[0.2em] uppercase transition hover:border-gold hover:text-gold"
          >
            Show more ({visible.length - limit})
          </button>
        </div>
      )}

      {current && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/95 p-4"
          onClick={() => setOpen(null)}
        >
          <div className="viewfinder relative max-h-full p-6 text-cream/70" onClick={(e) => e.stopPropagation()}>
            <Image
              src={current.src}
              alt={current.alt}
              width={current.width}
              height={current.height}
              sizes="90vw"
              className="max-h-[80vh] w-auto object-contain"
            />
          </div>
          {visible.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  step(-1);
                }}
                className="absolute top-1/2 left-2 -translate-y-1/2 p-4 text-3xl text-cream/70 hover:text-gold"
                aria-label="Previous photo"
              >
                ‹
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  step(1);
                }}
                className="absolute top-1/2 right-2 -translate-y-1/2 p-4 text-3xl text-cream/70 hover:text-gold"
                aria-label="Next photo"
              >
                ›
              </button>
            </>
          )}
          <button
            onClick={() => setOpen(null)}
            className="absolute top-4 right-4 p-2 text-sm tracking-[0.2em] text-cream uppercase"
          >
            Close ✕
          </button>
        </div>
      )}
    </>
  );
}
