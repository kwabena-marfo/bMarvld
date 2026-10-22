"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-api";

type Lock = { _id: string; kind: "booked" | "blocked"; reference: string };

const pretty = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export default function DatesAdmin() {
  const [locks, setLocks] = useState<Lock[] | null>(null);
  const [date, setDate] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    return adminFetch<{ dates: Lock[] }>("/dates")
      .then((d) => setLocks(d.dates))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function block(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await adminFetch("/dates/block", { method: "POST", body: JSON.stringify({ date }) });
      setDate("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not block date");
    }
  }

  async function unblock(d: string) {
    setError("");
    try {
      await adminFetch(`/dates/block/${d}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unblock date");
    }
  }

  return (
    <>
      <h1 className="mb-2 font-display text-4xl font-semibold">Dates</h1>
      <p className="mb-8 text-sm text-cream-dim">
        Booked dates are closed automatically once a deposit is paid. Block any other day you&apos;re unavailable.
      </p>

      <form onSubmit={block} className="mb-10 flex max-w-md gap-3">
        <input
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="field scheme-dark"
        />
        <button className="shrink-0 bg-gold px-6 text-xs font-semibold tracking-[0.2em] text-ink uppercase hover:bg-cream">
          Block
        </button>
      </form>

      {error && <p className="mb-4 text-gold">{error}</p>}
      {!locks && !error && <p className="text-cream-dim">Loading…</p>}
      {locks?.length === 0 && <p className="text-cream-dim">No upcoming booked or blocked dates.</p>}

      <ul className="max-w-xl divide-y divide-cream/10 border-y border-cream/10">
        {locks?.map((l) => (
          <li key={l._id} className="flex items-center justify-between gap-4 py-3">
            <span>{pretty(l._id)}</span>
            {l.kind === "booked" ? (
              <span className="text-xs tracking-wider text-gold uppercase">Booked · {l.reference}</span>
            ) : (
              <button onClick={() => unblock(l._id)} className="text-xs tracking-wider text-cream-dim uppercase hover:text-cream">
                Blocked · Unblock
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
