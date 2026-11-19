"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import DatePicker from "./DatePicker";
import TimePicker from "./TimePicker";
import { Button } from "@/components/ui/button";
import { DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { depositFor, formatCedis, type Package } from "@/data/packages";
import { adminFetch } from "@/lib/admin-api";
import { applyFieldErrors, sendJson } from "@/lib/forms";
import { manualBookingSchema, paymentMethods } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type FormInput = z.input<typeof manualBookingSchema>;
type FormOutput = z.output<typeof manualBookingSchema>;

// For a client who paid in person, by MoMo or by transfer: the admin types in
// their details and what they paid, and the date is booked straight away.
export default function ManualBookingForm({ onCreated }: { onCreated: (name: string) => void }) {
  const [packages, setPackages] = useState<Package[] | null>(null);
  const [unavailable, setUnavailable] = useState<Set<string> | null>(null);

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(manualBookingSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      packageId: "",
      date: "",
      time: "",
      location: "",
      notes: "",
      paymentMethod: "Cash",
      paymentNote: "",
      notify: true,
    },
  });
  const { setValue } = form;

  useEffect(() => {
    adminFetch<{ packages: Package[] }>("/packages")
      .then((d) => {
        setPackages(d.packages);
        const first = d.packages.find((p) => p.active) ?? d.packages[0];
        if (first) {
          setValue("packageId", first.id);
          setValue("amountPaid", depositFor(first));
        }
      })
      .catch((e) => toast.error(e.message));
    fetch("/api/availability")
      .then((r) => r.json())
      .then((d) => setUnavailable(new Set<string>(d.unavailableDates ?? [])))
      .catch(() => setUnavailable(new Set()));
  }, [setValue]);

  const packageId = useWatch({ control: form.control, name: "packageId" });
  const amountPaid = useWatch({ control: form.control, name: "amountPaid" });
  const pkg = packages?.find((p) => p.id === packageId);

  async function onSubmit(values: FormOutput) {
    try {
      await sendJson("/api/admin/bookings", values);
      onCreated(values.name);
    } catch (err) {
      if (!applyFieldErrors(form.setError, err)) toast.error(err instanceof Error ? err.message : "Could not save");
    }
  }

  const textField = (
    name: "name" | "phone" | "email" | "location",
    label: string,
    inputProps: React.ComponentProps<typeof Input> = {},
    className?: string
  ) => (
    <Controller
      name={name}
      control={form.control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          <FieldLabel htmlFor={`manual-${name}`}>{label}</FieldLabel>
          <Input {...inputProps} {...field} id={`manual-${name}`} aria-invalid={fieldState.invalid} />
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <DialogHeader className="mb-6">
        <DialogTitle className="font-display text-2xl">New booking</DialogTitle>
        <p className="text-sm text-cream-dim">
          For a client who paid you directly: cash, Mobile Money or a transfer. The date is booked straight away.
        </p>
      </DialogHeader>

      <FieldGroup className="gap-5">
        <Controller
          name="packageId"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="manual-package">Package</FieldLabel>
              <Select
                value={field.value}
                onValueChange={(v) => {
                  field.onChange(v);
                  const p = packages?.find((x) => x.id === v);
                  if (p) setValue("amountPaid", depositFor(p), { shouldValidate: true });
                }}
              >
                <SelectTrigger id="manual-package" className="w-full" aria-invalid={fieldState.invalid}>
                  <SelectValue placeholder={packages ? "Choose a package" : "Loading…"}>
                    {(v: string) => {
                      const p = packages?.find((x) => x.id === v);
                      return p ? `${p.name} · ${formatCedis(p.price)}` : "Choose a package";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {packages?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · {formatCedis(p.price)}
                      {!p.active && " (hidden on site)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          {textField("name", "Client's full name", { autoComplete: "off" }, "sm:col-span-2")}
          {textField("phone", "Phone", { type: "tel", placeholder: "024 000 0000" })}
          {textField("email", "Email (optional)", { type: "email" })}
        </div>

        <Controller
          name="date"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Date</FieldLabel>
              {unavailable ? (
                <DatePicker
                  value={field.value}
                  onChange={field.onChange}
                  unavailable={unavailable}
                  invalid={fieldState.invalid}
                  allowToday
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

        <div className="grid gap-5 sm:grid-cols-2">
          <Controller
            name="time"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="manual-time">Start time</FieldLabel>
                <TimePicker
                  id="manual-time"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          {textField("location", "Location", { placeholder: "e.g. East Legon, Accra" })}
        </div>

        <Controller
          name="notes"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="manual-notes">Notes (optional)</FieldLabel>
              <Textarea {...field} id="manual-notes" rows={2} className="resize-none" aria-invalid={fieldState.invalid} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <div className="grid gap-5 border-t border-cream/10 pt-5 sm:grid-cols-2">
          <Controller
            name="amountPaid"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="manual-amount">Amount paid (GH₵)</FieldLabel>
                <Input
                  id="manual-amount"
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={Number.isFinite(field.value) ? String(field.value) : ""}
                  onChange={(e) => field.onChange(e.target.value === "" ? undefined : e.target.valueAsNumber)}
                  aria-invalid={fieldState.invalid}
                />
                {pkg && (
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: `Deposit ${formatCedis(depositFor(pkg))}`, value: depositFor(pkg) },
                      { label: `In full ${formatCedis(pkg.price)}`, value: pkg.price },
                    ].map((o) => (
                      <Button
                        key={o.label}
                        type="button"
                        variant="outline"
                        size="xs"
                        className={cn("tracking-wider", amountPaid === o.value && "border-gold text-gold")}
                        onClick={() => setValue("amountPaid", o.value, { shouldValidate: true })}
                      >
                        {o.label}
                      </Button>
                    ))}
                  </div>
                )}
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            name="paymentMethod"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="manual-method">Paid by</FieldLabel>
                <Select value={field.value} onValueChange={(v) => field.onChange(v)}>
                  <SelectTrigger id="manual-method" className="w-full" aria-invalid={fieldState.invalid}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            name="paymentNote"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="sm:col-span-2">
                <FieldLabel htmlFor="manual-payment-note">Payment reference (optional)</FieldLabel>
                <Input
                  {...field}
                  id="manual-payment-note"
                  placeholder="e.g. MoMo transaction ID"
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        </div>

        <Controller
          name="notify"
          control={form.control}
          render={({ field }) => (
            <Field orientation="horizontal">
              <Switch id="manual-notify" checked={field.value} onCheckedChange={field.onChange} />
              <div>
                <FieldLabel htmlFor="manual-notify">Send the client their confirmation</FieldLabel>
                <FieldDescription>By text, and by email if you entered one.</FieldDescription>
              </div>
            </Field>
          )}
        />
      </FieldGroup>

      <DialogFooter className="mt-8">
        <Button type="submit" disabled={form.formState.isSubmitting || !packages}>
          {form.formState.isSubmitting ? "Saving…" : "Save booking"}
        </Button>
      </DialogFooter>
    </form>
  );
}
