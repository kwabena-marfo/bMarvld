import Image from "next/image";
import { connection } from "next/server";
import { studioBackdrop } from "@/data/gallery";
import { listPhotos } from "@/lib/photos";

// Enough small tiles to cover the booking section on a wide screen; the photos
// repeat when there are fewer uploads than tiles.
const tileCount = 240;

// Behind "Book a session": the uploaded gallery as a wall of small squares.
// Until something's uploaded, the studio backdrop stands in.
export default async function BookingBackdrop() {
  await connection();
  const photos = await listPhotos().catch((err) => {
    console.error("Could not load booking backdrop:", err);
    return [];
  });
  if (!photos.length) return <StudioBackdrop />;

  // Shift each row's starting photo so repeats don't line up in columns.
  const tiles = Array.from({ length: tileCount }, (_, i) => photos[(i + Math.floor(i / 11) * 3) % photos.length]);

  return (
    <div
      aria-hidden
      className="absolute inset-0 -z-10 grid auto-rows-min grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-1 overflow-hidden opacity-35 sm:grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] in-[.light]:opacity-30"
    >
      {tiles.map((p, i) => (
        <div key={i} className="relative aspect-square bg-ink-soft">
          <Image src={p.src} alt="" fill sizes="112px" className="object-cover" />
        </div>
      ))}
    </div>
  );
}

// A studio set, softly out of focus.
export function StudioBackdrop() {
  return (
    <Image
      src={studioBackdrop.src}
      alt=""
      fill
      sizes="100vw"
      className="-z-10 object-cover object-[center_30%] opacity-30 blur-[3px] in-[.light]:opacity-25"
    />
  );
}
