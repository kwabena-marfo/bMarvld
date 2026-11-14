"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { EmptyList, ListPagination, ListSearch, useListParams } from "@/components/AdminList";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { adminFetch } from "@/lib/admin-api";
import { applyFieldErrors, sendJson } from "@/lib/forms";
import { matchesSearch, paginate } from "@/lib/listQuery";
import { blockDateSchema } from "@/lib/schemas";

type Lock = { _id: string; kind: "booked" | "blocked"; reference: string };
const pageSize = 20;
type Values = z.output<typeof blockDateSchema>;

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const pretty = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export default function DatesAdmin() {
  const [locks, setLocks] = useState<Lock[] | null>(null);
  const [open, setOpen] = useState(false);

  const form = useForm<z.input<typeof blockDateSchema>, unknown, Values>({
    resolver: zodResolver(blockDateSchema),
    defaultValues: { date: "" },
  });

  const load = useCallback(() => {
    return adminFetch<{ dates: Lock[] }>("/dates")
      .then((d) => setLocks(d.dates))
      .catch((e) => toast.error(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function block({ date }: Values) {
    try {
      await sendJson("/api/admin/dates/block", { date });
      toast.success(`${pretty(date)} blocked`);
      form.reset();
      load();
    } catch (err) {
      if (!applyFieldErrors(form.setError, err)) {
        form.setError("date", { message: err instanceof Error ? err.message : "Could not block date" });
      }
    }
  }

  async function unblock(date: string) {
    try {
      await sendJson(`/api/admin/dates/block/${date}`, undefined, "DELETE");
      toast.success(`${pretty(date)} is open again`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not unblock date");
    }
  }

  const taken = new Set(locks?.map((l) => l._id));
  const list = useListParams();
  const found = locks?.filter((l) =>
    matchesSearch(list.q, pretty(l._id), l._id, l.kind === "booked" ? `booked ${l.reference}` : "blocked"),
  );
  const shown = found && paginate(found, list.page, pageSize);

  return (
    <>
      <h1 className="mb-2 font-display text-4xl font-semibold">Dates</h1>
      <p className="mb-8 text-sm text-cream-dim">
        Booked dates close automatically once a deposit is paid. Block any other day you&apos;re unavailable.
      </p>

      <form onSubmit={form.handleSubmit(block)} className="mb-10 flex max-w-md items-start gap-3" noValidate>
        <Controller
          name="date"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="block-date" className="sr-only">
                Date to block
              </FieldLabel>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger
                  id="block-date"
                  aria-invalid={fieldState.invalid || undefined}
                  className="flex h-12 w-full items-center justify-between border border-input bg-ink-soft px-4 text-left text-sm outline-none focus-visible:border-ring aria-expanded:border-ring aria-invalid:border-destructive"
                >
                  <span className={field.value ? "" : "text-cream/40"}>
                    {field.value ? pretty(field.value) : "Pick a date to block"}
                  </span>
                  <CalendarIcon className="size-4 text-muted-foreground" />
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-3">
                  <Calendar
                    mode="single"
                    selected={field.value ? new Date(`${field.value}T00:00:00`) : undefined}
                    onSelect={(d) => {
                      field.onChange(d ? iso(d) : "");
                      setOpen(false);
                    }}
                    disabled={[{ before: new Date() }, (d) => taken.has(iso(d))]}
                    className="[--cell-size:--spacing(9)]"
                  />
                </PopoverContent>
              </Popover>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Button type="submit" size="lg" disabled={form.formState.isSubmitting} className="shrink-0">
          Block
        </Button>
      </form>

      <ListSearch value={list.q} onSearch={list.setQuery} placeholder="Search month, day, reference…" className="mb-6 sm:max-w-xl" />

      {!locks && <p className="text-cream-dim">Loading…</p>}
      {found?.length === 0 && (
        <EmptyList q={list.q} empty="No upcoming booked or blocked dates." noun="dates" />
      )}

      <ul className="max-w-xl divide-y divide-cream/10 border-y border-cream/10 empty:border-0">
        {shown?.items.map((l) => (
          <li key={l._id} className="flex items-center justify-between gap-4 py-3">
            <span>{pretty(l._id)}</span>
            {l.kind === "booked" ? (
              <Badge>Booked · {l.reference}</Badge>
            ) : (
              <div className="flex items-center gap-3">
                <Badge variant="outline">Blocked</Badge>
                <AlertDialog>
                  <AlertDialogTrigger render={<Button variant="link" size="sm" className="px-0 text-cream-dim" />}>
                    Unblock
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Unblock {pretty(l._id)}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Clients will be able to book this day on the site again.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => unblock(l._id)}>Unblock</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </li>
        ))}
      </ul>

      {found && (
        <div className="max-w-xl">
          <ListPagination
            page={list.page}
            pageSize={pageSize}
            total={found.length}
            noun={["date", "dates"]}
            onPage={list.setPage}
          />
        </div>
      )}
    </>
  );
}
