"use client";

import { useCallback, useEffect, useState } from "react";
import DatePicker from "./DatePicker";
import { DEPOSIT_RATE, depositFor, formatCedis, packages } from "@/data/packages";

type FieldErrors = Partial<Record<string, string>>;

export default function BookingForm() {
  const [packageId, setPackageId] = useState(packages[0].id);
  const [date, setDate] = useState("");
  // null until loaded, which also keeps the calendar out of the prerender.
  const [unavailable, setUnavailable] = useState<Set<string> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const loadAvailability = useCallback(() => {
    return fetch("/api/availability")
      .then((r) => r.json())
      .then((d) => setUnavailable(new Set<string>(d.unavailableDates ?? [])))
      .catch(() => setUnavailable((prev) => prev ?? new Set()));
  }, []);

  useEffect(() => {
    loadAvailability();
  }, [loadAvailability]);

  // Lets the "Book this" buttons in the Packages section preselect a package.
  useEffect(() => {
    const onPick = (e: Event) => setPackageId((e as CustomEvent<string>).detail);
    window.addEventListener("pick-package", onPick);
    return () => window.removeEventListener("pick-package", onPick);
  }, []);

  const pkg = packages.find((p) => p.id === packageId)!;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setSubmitting(true);

    const form = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, packageId, date }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          // Someone else got the date first — refresh the calendar and clear the pick.
          setDate("");
          loadAvailability();
        }
        setError(data.error ?? "Something went wrong");
        setFieldErrors(data.fieldErrors ?? {});
        setSubmitting(false);
        return;
      }
      window.location.href = data.authorizationUrl;
    } catch {
      setError("Network error. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  const err = (name: string) =>
    fieldErrors[name] ? <p className="mt-1 text-xs text-gold">{fieldErrors[name]}</p> : null;

  return (
    <form onSubmit={onSubmit} className="grid gap-10 lg:grid-cols-[1fr_340px]" noValidate>
      <div className="grid gap-6">
        <fieldset>
          <legend className="field-label">Package</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {packages.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => setPackageId(p.id)}
                className={`border p-4 text-left transition ${
                  p.id === packageId ? "border-gold bg-gold/10" : "border-cream/20 hover:border-cream/50"
                }`}
              >
                <span className="block font-display text-lg">{p.name}</span>
                <span className="text-sm text-cream-dim">
                  {formatCedis(p.price)} · {p.duration}
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-6 sm:grid-cols-2">
          <label>
            <span className="field-label">Full name</span>
            <input name="name" required autoComplete="name" className="field" />
            {err("name")}
          </label>
          <label>
            <span className="field-label">Phone</span>
            <input name="phone" type="tel" required autoComplete="tel" placeholder="024 000 0000" className="field" />
            {err("phone")}
          </label>
          <label className="sm:col-span-2">
            <span className="field-label">Email</span>
            <input name="email" type="email" required autoComplete="email" className="field" />
            {err("email")}
          </label>
          <div className="sm:col-span-2">
            <span className="field-label">Date</span>
            {unavailable ? (
              <DatePicker value={date} onChange={setDate} unavailable={unavailable} />
            ) : (
              <div className="flex h-80 items-center justify-center border border-cream/20 bg-ink-soft text-sm text-cream-dim">
                Loading available dates…
              </div>
            )}
            {err("date")}
          </div>
          <label className="sm:col-span-2">
            <span className="field-label">Start time</span>
            <input name="time" type="time" required className="field scheme-dark" />
            {err("time")}
          </label>
          <label className="sm:col-span-2">
            <span className="field-label">Location</span>
            <input name="location" required placeholder="e.g. East Legon, Accra" className="field" />
            {err("location")}
          </label>
          <label className="sm:col-span-2">
            <span className="field-label">Anything else? (optional)</span>
            <textarea name="notes" rows={4} placeholder="Tell us about your vision" className="field resize-none" />
          </label>
        </div>
      </div>

      <aside className="viewfinder h-fit p-8 text-cream/40">
        <div className="text-cream">
          <p className="field-label">Summary</p>
          <p className="font-display text-2xl">{pkg.name}</p>
          <ul className="mt-4 space-y-1 text-sm text-cream-dim">
            {pkg.features.map((f) => (
              <li key={f}>— {f}</li>
            ))}
          </ul>
          <dl className="mt-6 space-y-2 border-t border-cream/10 pt-6 text-sm">
            <div className="flex justify-between">
              <dt className="text-cream-dim">Session total</dt>
              <dd>{formatCedis(pkg.price)}</dd>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <dt>Deposit due now ({DEPOSIT_RATE * 100}%)</dt>
              <dd className="text-gold">{formatCedis(depositFor(pkg))}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-cream-dim">Balance on the day</dt>
              <dd>{formatCedis(pkg.price - depositFor(pkg))}</dd>
            </div>
          </dl>

          {error && <p className="mt-6 border border-gold/40 p-3 text-sm text-gold">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full bg-gold py-4 text-sm font-semibold tracking-[0.2em] text-ink uppercase transition hover:bg-cream disabled:opacity-50"
          >
            {submitting ? "Redirecting to payment…" : `Pay ${formatCedis(depositFor(pkg))} deposit`}
          </button>
          <p className="mt-3 text-center text-xs text-cream-dim">
            Secure payment by Paystack · Card or Mobile Money
          </p>
        </div>
      </aside>
    </form>
  );
}
