"use client";

import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyList, ListPagination, ListSearch, useAdminList, useListParams } from "@/components/AdminList";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { sendJson } from "@/lib/forms";
import { cn } from "@/lib/utils";
import { formatCedis } from "@/data/packages";
import type { BookingStatus } from "@/lib/bookings";

type Booking = {
  reference: string;
  name: string;
  email: string;
  phone: string;
  packageName: string;
  price: number;
  depositPercent?: number; // missing on bookings made before deposits were per package
  deposit: number;
  date: string;
  time: string;
  location: string;
  notes: string;
  status: BookingStatus;
  createdAt: string;
};

const statusStyles: Record<BookingStatus, string> = {
  deposit_paid: "",
  needs_refund: "bg-destructive text-primary-foreground",
  pending: "border-cream/30 bg-transparent text-cream-dim",
  failed: "border-transparent bg-transparent text-cream/40",
};

const statusLabels: Record<BookingStatus, string> = {
  deposit_paid: "Deposit paid",
  needs_refund: "Needs refund",
  pending: "Awaiting payment",
  failed: "Failed",
};

type BookingList = { bookings: Booking[]; total: number; pageSize: number };

export default function BookingsPage() {
  const list = useListParams();
  const { q, page } = list;
  const showAll = list.get("all") === "1";
  const query = new URLSearchParams({ q, page: String(page), ...(showAll && { all: "1" }) }).toString();
  const { data, error, loading, reload } = useAdminList<BookingList>(`/bookings?${query}`);
  const [confirming, setConfirming] = useState<Booking | null>(null);

  async function remove(b: Booking) {
    try {
      await sendJson(`/api/admin/bookings/${encodeURIComponent(b.reference)}`, undefined, "DELETE");
      toast.success(`${b.name}'s booking deleted`);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
    }
  }

  const bookings = data?.bookings;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl font-semibold">Bookings</h1>
        <label className="flex items-center gap-2 text-sm text-cream-dim">
          <Switch checked={showAll} onCheckedChange={(on) => list.set({ all: on ? "1" : null })} />
          Include unpaid &amp; failed
        </label>
      </div>

      <ListSearch
        value={q}
        onSearch={list.setQuery}
        placeholder="Search name, phone, reference…"
        className="mb-6"
      />

      {error && <p className="text-gold">{error}</p>}
      {!data && !error && <p className="text-cream-dim">Loading…</p>}
      {bookings?.length === 0 && !loading && <EmptyList q={q} empty="No bookings yet." noun="bookings" />}

      <div className={cn("grid gap-3 transition-opacity", loading && data && "opacity-50")}>
        {bookings?.map((b) => (
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
                {formatCedis(b.deposit)} deposit{b.depositPercent ? ` (${b.depositPercent}%)` : ""} of{" "}
                {formatCedis(b.price)} · {b.reference}
              </p>
            </div>
            <div className="flex items-start justify-between gap-2 md:flex-col md:items-end">
              <Badge className={cn("tracking-wider uppercase", statusStyles[b.status])}>{statusLabels[b.status]}</Badge>
              <Button variant="ghost" size="icon-sm" aria-label={`Delete ${b.name}'s booking`} onClick={() => setConfirming(b)}>
                <Trash2Icon className="text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <AlertDialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirming?.name}&apos;s booking?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirming?.status === "deposit_paid" || confirming?.status === "needs_refund"
                ? `${confirming.date} opens up for booking again. Their ${formatCedis(confirming.deposit)} deposit isn't refunded automatically; refund it from your Paystack dashboard if you need to. This can't be undone.`
                : "It's removed from your bookings, and its date is freed if it was still being held. This can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => confirming && remove(confirming)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {data && (
        <ListPagination
          page={page}
          pageSize={data.pageSize}
          total={data.total}
          noun={["booking", "bookings"]}
          onPage={list.setPage}
        />
      )}
    </>
  );
}
