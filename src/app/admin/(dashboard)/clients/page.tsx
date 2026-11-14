"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { EmptyList, ListPagination, ListSearch, useAdminList, useListParams } from "@/components/AdminList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { galleryStatusLabels, type GalleryStatus } from "@/data/clientGalleries";
import { adminFetch } from "@/lib/admin-api";
import { formatDate } from "@/lib/formatDate";
import { applyFieldErrors, sendJson } from "@/lib/forms";
import { clientGallerySchema } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type GallerySummary = {
  id: string;
  clientName: string;
  title: string;
  status: GalleryStatus;
  proofs: number;
  selected: number;
  finals: number;
};

type PaidBooking = { reference: string; name: string; phone: string; email: string; packageName: string; date: string; status: string };

type GalleryList = { galleries: GallerySummary[]; total: number; pageSize: number };

export default function ClientsAdmin() {
  const [creating, setCreating] = useState(false);
  const list = useListParams();
  const { q, page } = list;
  const { data, error, loading } = useAdminList<GalleryList>(`/clients?${new URLSearchParams({ q, page: String(page) })}`);
  const galleries = data?.galleries;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold">Clients</h1>
          <p className="mt-2 text-sm text-cream-dim">
            Upload a shoot&apos;s photos, let the client pick their favourites, then deliver the edits.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <PlusIcon /> New client gallery
        </Button>
      </div>

      <ListSearch value={q} onSearch={list.setQuery} placeholder="Search client, shoot, phone, booking…" className="mb-6" />

      {error && <p className="text-gold">{error}</p>}
      {!data && !error && <p className="text-cream-dim">Loading…</p>}
      {galleries?.length === 0 && !loading && <EmptyList q={q} empty="No client galleries yet." noun="galleries" />}

      <div className={cn("grid gap-3 transition-opacity", loading && data && "opacity-50")}>
        {galleries?.map((g) => (
          <Link
            key={g.id}
            href={`/admin/clients/${g.id}`}
            className="grid gap-2 border border-cream/15 p-5 transition hover:border-gold/60 sm:grid-cols-[1fr_auto] sm:items-center"
          >
            <div>
              <p className="font-display text-xl">{g.clientName}</p>
              <p className="text-sm text-cream-dim">{g.title}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-cream-dim">
              <span>
                {g.proofs} proofs · {g.selected} picked · {g.finals} edited
              </span>
              <Badge variant={g.status === "submitted" ? "default" : "outline"} className="tracking-wider uppercase">
                {galleryStatusLabels[g.status]}
              </Badge>
            </div>
          </Link>
        ))}
      </div>

      {data && (
        <ListPagination
          page={page}
          pageSize={data.pageSize}
          total={data.total}
          noun={["gallery", "galleries"]}
          onPage={list.setPage}
        />
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">{creating && <NewGalleryForm />}</DialogContent>
      </Dialog>
    </>
  );
}

function NewGalleryForm() {
  const router = useRouter();
  const [bookings, setBookings] = useState<PaidBooking[]>([]);

  useEffect(() => {
    adminFetch<{ bookings: PaidBooking[] }>("/bookings?pageSize=100")
      .then((d) => setBookings(d.bookings.filter((b) => b.status === "deposit_paid")))
      .catch(() => {});
  }, []);

  const form = useForm<z.input<typeof clientGallerySchema>, unknown, z.output<typeof clientGallerySchema>>({
    resolver: zodResolver(clientGallerySchema),
    defaultValues: { clientName: "", clientPhone: "", clientEmail: "", title: "", maxSelections: null, bookingReference: "" },
  });

  function fromBooking(reference: string) {
    const b = bookings.find((x) => x.reference === reference);
    if (!b) return;
    form.reset({
      ...form.getValues(),
      clientName: b.name,
      clientPhone: b.phone,
      clientEmail: b.email,
      title: `${b.packageName} session, ${formatDate(b.date)}`,
      bookingReference: b.reference,
    });
  }

  async function onSubmit(values: z.output<typeof clientGallerySchema>) {
    try {
      const { id } = await sendJson<{ id: string }>("/api/admin/clients", values);
      router.push(`/admin/clients/${id}`);
    } catch (err) {
      if (!applyFieldErrors(form.setError, err)) toast.error(err instanceof Error ? err.message : "Could not create");
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <DialogHeader className="mb-6">
        <DialogTitle className="font-display text-2xl">New client gallery</DialogTitle>
      </DialogHeader>

      <FieldGroup>
        {bookings.length > 0 && (
          <Field>
            <FieldLabel htmlFor="gallery-booking">From a booking (optional)</FieldLabel>
            <Select onValueChange={(v) => fromBooking(String(v))}>
              <SelectTrigger id="gallery-booking" className="w-full">
                <SelectValue placeholder="Fill in from a paid booking" />
              </SelectTrigger>
              <SelectContent>
                {bookings.map((b) => (
                  <SelectItem key={b.reference} value={b.reference}>
                    {b.name} · {b.packageName}, {formatDate(b.date)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        <Controller
          name="clientName"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="gallery-name">Client name</FieldLabel>
              <Input {...field} id="gallery-name" aria-invalid={fieldState.invalid} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Controller
            name="clientPhone"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="gallery-phone">Phone</FieldLabel>
                <Input {...field} id="gallery-phone" type="tel" placeholder="024 000 0000" aria-invalid={fieldState.invalid} />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            name="clientEmail"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="gallery-email">Email (optional)</FieldLabel>
                <Input {...field} id="gallery-email" type="email" aria-invalid={fieldState.invalid} />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        </div>
        <Controller
          name="title"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="gallery-title">Shoot</FieldLabel>
              <Input {...field} id="gallery-title" placeholder="e.g. Graduation portraits" aria-invalid={fieldState.invalid} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          name="maxSelections"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="gallery-max">Photos the client can pick</FieldLabel>
              <Input
                id="gallery-max"
                name={field.name}
                ref={field.ref}
                onBlur={field.onBlur}
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                placeholder="No limit"
                value={field.value ?? ""}
                onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.valueAsNumber)}
                aria-invalid={fieldState.invalid}
              />
              {fieldState.error ? (
                <FieldError errors={[fieldState.error]} />
              ) : (
                <FieldDescription>Usually the package&apos;s number of edited photos. Leave empty for no limit.</FieldDescription>
              )}
            </Field>
          )}
        />
      </FieldGroup>

      <DialogFooter className="mt-8">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Creating…" : "Create gallery"}
        </Button>
      </DialogFooter>
    </form>
  );
}
