"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import LogoLoader from "./LogoLoader";
import { photoCategories, type Shot } from "@/data/gallery";
import { cn } from "@/lib/utils";

const PAGE = 12;
// "Show more" stops showing its loader after this even if some photos are still coming.
const MORE_TIMEOUT_MS = 10_000;
const TILE_SIZES = "(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw";
const LIGHTBOX_SIZES = "90vw";

export default function Gallery({ shots }: { shots: Shot[] }) {
  const [filter, setFilter] = useState("All");
  const [limit, setLimit] = useState(PAGE);
  // Only offer categories that actually have photos.
  const categories = ["All", ...photoCategories.filter((cat) => shots.some((s) => s.category === cat))];
  const [open, setOpen] = useState<number | null>(null);
  // The photos revealed by the last "Show more" that are still loading.
  const [loadingMore, setLoadingMore] = useState<Set<string> | null>(null);

  // The lightbox steps through every photo in the filter, not just those shown.
  const visible = filter === "All" ? shots : shots.filter((s) => s.category === filter);
  const shown = visible.slice(0, limit);
  const step = (n: number) => setOpen((i) => (i! + n + visible.length) % visible.length);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((i) => (i! + 1) % visible.length);
      if (e.key === "ArrowLeft") setOpen((i) => (i! - 1 + visible.length) % visible.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, visible.length]);

  useEffect(() => {
    if (!loadingMore) return;
    const timer = setTimeout(() => setLoadingMore(null), MORE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [loadingMore]);

  function showMore() {
    const batch = visible.slice(limit, limit + PAGE);
    setLimit((l) => l + PAGE);
    setLoadingMore(new Set(batch.map(key)));
  }

  function tileLoaded(shot: Shot) {
    setLoadingMore((pending) => {
      if (!pending?.has(key(shot))) return pending;
      const left = new Set(pending);
      left.delete(key(shot));
      return left.size ? left : null;
    });
  }

  const current = open !== null ? visible[open] : null;
  // The photos either side of the open one, loaded in the background so the
  // arrows usually land on a photo that's already there.
  const neighbours =
    open !== null && visible.length > 1
      ? [...new Set([(open + 1) % visible.length, (open - 1 + visible.length) % visible.length])]
          .filter((i) => i !== open)
          .map((i) => visible[i])
      : [];

  return (
    <>
      <div className="mb-10 flex flex-wrap justify-center gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => {
              setFilter(cat);
              setLimit(PAGE);
              setLoadingMore(null);
            }}
            className={`px-4 py-2 text-xs tracking-[0.2em] uppercase transition ${
              filter === cat ? "bg-cream text-ink" : "border border-cream/20 text-cream-dim hover:border-cream/60"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
        {shown.map((shot, i) => (
          <GalleryTile
            key={key(shot)}
            shot={shot}
            // The "Show more" batch loads straight away, even below the fold, so its loader can finish.
            eager={!!loadingMore?.has(key(shot))}
            onLoaded={() => tileLoaded(shot)}
            onOpen={() => setOpen(i)}
          />
        ))}
      </div>

      {loadingMore ? (
        <div className="mt-8 flex flex-col items-center gap-3">
          <LogoLoader label="Loading more photos" className="size-10" />
          <span className="text-xs tracking-[0.2em] text-cream-dim uppercase">Loading more</span>
        </div>
      ) : (
        visible.length > limit && (
          <div className="mt-8 text-center">
            <button
              onClick={showMore}
              className="border border-cream/30 px-8 py-3 text-xs tracking-[0.2em] uppercase transition hover:border-gold hover:text-gold"
            >
              Show more ({visible.length - limit})
            </button>
          </div>
        )
      )}

      {current && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/95 p-4"
          onClick={() => setOpen(null)}
        >
          <div className="viewfinder relative max-h-full p-6 text-cream/70" onClick={(e) => e.stopPropagation()}>
            {/* Keyed by photo, so stepping drops the old photo at once and shows the loader. */}
            <LightboxPhoto key={key(current)} shot={current} />
          </div>
          {neighbours.map((shot) => (
            <Image
              key={key(shot)}
              src={shot.src}
              alt=""
              aria-hidden
              width={shot.width}
              height={shot.height}
              sizes={LIGHTBOX_SIZES}
              loading="eager"
              className="hidden"
            />
          ))}
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

const key = (shot: Shot) => shot.id ?? shot.src;

function GalleryTile({
  shot,
  eager,
  onLoaded,
  onOpen,
}: {
  shot: Shot;
  eager: boolean;
  onLoaded: () => void;
  onOpen: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const done = () => {
    setLoaded(true);
    onLoaded();
  };

  return (
    <button onClick={onOpen} className="group relative mb-4 block w-full overflow-hidden break-inside-avoid bg-cream/5">
      <Image
        src={shot.src}
        alt={shot.alt}
        width={shot.width}
        height={shot.height}
        sizes={TILE_SIZES}
        loading={eager ? "eager" : "lazy"}
        onLoad={done}
        onError={done}
        className={cn(
          "h-auto w-full transition duration-700 group-hover:scale-105",
          loaded ? "opacity-100" : "opacity-0"
        )}
      />
      {!loaded && (
        <span className="absolute inset-0 flex items-center justify-center">
          <LogoLoader label="Loading photo" className="size-10 text-cream/40" />
        </span>
      )}
      <span className="absolute inset-0 flex items-end bg-linear-to-t from-ink/80 via-transparent p-4 opacity-0 transition group-hover:opacity-100">
        <span className="text-xs tracking-[0.25em] text-cream uppercase">
          <span className="text-gold">●</span> {shot.category}
        </span>
      </span>
    </button>
  );
}

function LightboxPhoto({ shot }: { shot: Shot }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      <Image
        src={shot.src}
        alt={shot.alt}
        width={shot.width}
        height={shot.height}
        sizes={LIGHTBOX_SIZES}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={cn(
          "max-h-[80vh] w-auto object-contain transition-opacity duration-300",
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
