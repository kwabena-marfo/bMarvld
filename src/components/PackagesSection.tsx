import { connection } from "next/server";
import { cache } from "react";
import BookingForm from "./BookingForm";
import PickPackageButton from "./PickPackageButton";
import { formatCedis } from "@/data/packages";
import { listPackages } from "@/lib/packages";

// One database read per request, shared by the packages grid and the booking
// form. Read fresh each visit so price changes from /admin/packages show at once.
const getSitePackages = cache(async () => {
  await connection();
  return listPackages({ activeOnly: true }).catch((err) => {
    console.error("Could not load packages:", err);
    return [];
  });
});

export async function PackagesGrid() {
  const packages = await getSitePackages();

  if (!packages.length) {
    return <p className="text-center text-cream-dim">New packages are on the way. Check back soon.</p>;
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {packages.map((p) => (
          <div key={p.id} className="flex flex-col border border-cream/15 bg-ink/70 p-6 backdrop-blur-sm transition hover:border-cream/40">
            <h3 className="font-display text-2xl">{p.name}</h3>
            <p className="mt-1 text-xs tracking-[0.2em] text-cream-dim uppercase">{p.duration}</p>
            <p className="mt-6 font-display text-3xl text-gold">{formatCedis(p.price)}</p>
            <p className="mt-1 text-xs text-cream-dim">{p.depositPercent}% deposit to book</p>
            <ul className="mt-6 flex-1 space-y-2 text-sm text-cream-dim">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <span aria-hidden className="text-gold">•</span>
                  {f}
                </li>
              ))}
            </ul>
            <PickPackageButton packageId={p.id} />
          </div>
        ))}
      </div>
      <p className="mt-8 text-center text-sm text-cream-dim">
        A deposit secures your date. The balance is paid on the day of the shoot.
      </p>
    </>
  );
}

export async function BookingSection() {
  return <BookingForm packages={await getSitePackages()} />;
}

export function SectionSkeleton({ height = "h-64" }: { height?: string }) {
  return <div className={`${height} animate-pulse bg-cream/5`} />;
}
