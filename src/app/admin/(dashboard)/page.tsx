"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-api";
import { formatCedis } from "@/data/packages";
import type { BookingStatus } from "@/lib/bookings";

type Booking = {
  reference: string;
  name: string;
  email: string;
  phone: string;
  packageName: string;
  price: number;
  deposit: number;
  date: string;
  time: string;
  location: string;
  notes: string;
  status: BookingStatus;
  createdAt: string;
};

const statusStyles: Record<BookingStatus, string> = {
  deposit_paid: "bg-gold text-ink",
  needs_refund: "bg-red-500 text-white",
  pending: "border border-cream/30 text-cream-dim",
  failed: "text-cream/40",
};

const statusLabels: Record<BookingStatus, string> = {
  deposit_paid: "Deposit paid",
  needs_refund: "Needs refund",
  pending: "Awaiting payment",
  failed: "Failed",
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    adminFetch<{ bookings: Booking[] }>("/bookings")
      .then((d) => setBookings(d.bookings))
      .catch((e) => setError(e.message));
  }, []);

  const visible = bookings?.filter((b) => showAll || b.status === "deposit_paid" || b.status === "needs_refund");

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl font-semibold">Bookings</h1>
        <label className="flex items-center gap-2 text-sm text-cream-dim">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="accent-gold" />
          Include unpaid &amp; failed
        </label>
      </div>

      {error && <p className="text-gold">{error}</p>}
      {!bookings && !error && <p className="text-cream-dim">Loading…</p>}
      {visible?.length === 0 && <p className="text-cream-dim">No bookings yet.</p>}

      <div className="grid gap-3">
        {visible?.map((b) => (
          <div key={b.reference} className="grid gap-4 border border-cream/15 p-5 md:grid-cols-[1fr_1fr_auto]">
            <div>
              <p className="font-display text-xl">{b.name}</p>
              <p className="text-sm text-cream-dim">
                <a href={`tel:${b.phone}`} className="hover:text-gold">
                  {b.phone}
                </a>{" "}
                ·{" "}
                <a href={`mailto:${b.email}`} className="hover:text-gold">
                  {b.email}
                </a>
              </p>
              {b.notes && <p className="mt-2 text-sm text-cream-dim italic">“{b.notes}”</p>}
            </div>
            <div className="text-sm">
              <p>
                <span className="text-gold">{b.date}</span> at {b.time}
              </p>
              <p className="text-cream-dim">
                {b.packageName} · {b.location}
              </p>
              <p className="text-cream-dim">
                {formatCedis(b.deposit)} deposit of {formatCedis(b.price)} · {b.reference}
              </p>
            </div>
            <div>
              <span className={`inline-block px-3 py-1 text-xs tracking-wider uppercase ${statusStyles[b.status]}`}>
                {statusLabels[b.status]}
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
