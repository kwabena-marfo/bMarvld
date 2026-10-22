"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import DatePicker from "./DatePicker";
import TimePicker from "./TimePicker";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { depositFor, formatCedis, type Package } from "@/data/packages";
import { ApiError, applyFieldErrors, sendJson } from "@/lib/forms";
import { bookingSchema } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type FormInput = z.input<typeof bookingSchema>;
type FormOutput = z.output<typeof bookingSchema>;

export default function BookingForm({ packages }: { packages: Package[] }) {
  // null until loaded, which also keeps the calendar out of the server render.
  const [unavailable, setUnavailable] = useState<Set<string> | null>(null);
  const [error, setError] = useState("");

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      packageId: packages[0]?.id ?? "",
      date: "",
      time: "",
      location: "",
      notes: "",
    },
  });

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
  const { setValue } = form;
  useEffect(() => {
    const onPick = (e: Event) =>
      setValue("packageId", (e as CustomEvent<string>).detail, { shouldValidate: true });
    window.addEventListener("pick-package", onPick);
    return () => window.removeEventListener("pick-package", onPick);
  }, [setValue]);

  const packageId = useWatch({ control: form.control, name: "packageId" });
  const pkg = packages.find((p) => p.id === packageId);

  async function onSubmit(values: FormOutput) {
    setError("");
    try {
      const data = await sendJson<{ authorizationUrl: string }>("/api/bookings", values);
      window.location.assign(data.authorizationUrl); // off to Paystack checkout
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Someone else got the date (or the package changed) — refresh the calendar.
        loadAvailability();
      }
      applyFieldErrors(form.setError, err);
      setError(err instanceof Error ? err.message : "Network error. Check your connection and try again.");
    }
  }

  if (!packages.length) {
    return (
      <p className="text-center text-cream-dim">
        Bookings are closed for now — check back soon or reach out on Instagram.
      </p>
    );
  }

  const { isSubmitting } = form.formState;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-10 lg:grid-cols-[1fr_340px]" noValidate>
      <FieldGroup className="gap-6">
        <Controller
          name="packageId"
          control={form.control}
          render={({ field, fieldState }) => (
            <FieldSet data-invalid={fieldState.invalid}>
              <FieldLegend variant="label" className="text-xs tracking-[0.2em] text-cream-dim uppercase">
                Package
              </FieldLegend>
              <div role="radiogroup" className="grid gap-3 sm:grid-cols-2">
                {packages.map((p) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={p.id === field.value}
                    key={p.id}
                    onClick={() => field.onChange(p.id)}
                    className={cn(
                      "border p-4 text-left transition",
                      p.id === field.value ? "border-gold bg-gold/10" : "border-cream/20 hover:border-cream/50"
                    )}
                  >
                    <span className="block font-display text-lg">{p.name}</span>
                    <span className="text-sm text-cream-dim">
                      {formatCedis(p.price)} · {p.duration}
                    </span>
                  </button>
                ))}
              </div>
              <FieldError errors={[fieldState.error]} />
            </FieldSet>
          )}
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="book-name">Full name</FieldLabel>
                <Input {...field} id="book-name" autoComplete="name" aria-invalid={fieldState.invalid} />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            name="phone"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="book-phone">Phone</FieldLabel>
                <Input
                  {...field}
                  id="book-phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="024 000 0000"
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            name="email"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="sm:col-span-2">
                <FieldLabel htmlFor="book-email">Email</FieldLabel>
                <Input {...field} id="book-email" type="email" autoComplete="email" aria-invalid={fieldState.invalid} />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            name="date"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="sm:col-span-2">
                <FieldLabel>Date</FieldLabel>
                {unavailable ? (
                  <DatePicker
                    value={field.value}
                    onChange={field.onChange}
                    unavailable={unavailable}
                    invalid={fieldState.invalid}
                  />
                ) : (
                  <div className="flex h-80 items-center justify-center border border-input bg-ink-soft text-sm text-cream-dim">
                    Loading available dates…
                  </div>
                )}
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            name="time"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="book-time">Start time</FieldLabel>
                <TimePicker
                  id="book-time"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            name="location"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="book-location">Location</FieldLabel>
                <Input
                  {...field}
                  id="book-location"
                  placeholder="e.g. East Legon, Accra"
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            name="notes"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="sm:col-span-2">
                <FieldLabel htmlFor="book-notes">Anything else? (optional)</FieldLabel>
                <Textarea
                  {...field}
                  id="book-notes"
                  rows={4}
                  placeholder="Tell us about your vision"
                  className="resize-none"
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        </div>
      </FieldGroup>

      <aside className="viewfinder h-fit p-8 text-cream/40">
        {pkg && (
          <div className="text-cream">
            <p className="mb-2 text-xs font-medium tracking-[0.2em] text-cream-dim uppercase">Summary</p>
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
                <dt>Deposit due now ({pkg.depositPercent}%)</dt>
                <dd className="text-gold">{formatCedis(depositFor(pkg))}</dd>
              </div>
              {pkg.depositPercent < 100 && (
                <div className="flex justify-between">
                  <dt className="text-cream-dim">Balance on the day</dt>
                  <dd>{formatCedis(pkg.price - depositFor(pkg))}</dd>
                </div>
              )}
            </dl>

            {error && <p className="mt-6 border border-destructive/50 p-3 text-sm text-destructive">{error}</p>}

            <Button type="submit" size="lg" disabled={isSubmitting} className="mt-6 w-full">
              {isSubmitting ? "Redirecting to payment…" : `Pay ${formatCedis(depositFor(pkg))} deposit`}
            </Button>
            <p className="mt-3 text-center text-xs text-cream-dim">Secure payment by Paystack · Card or Mobile Money</p>
          </div>
        )}
      </aside>
    </form>
  );
}
