import crypto from "crypto";
import type { Filter } from "mongodb";
import { getDb } from "./mongodb";
import { searchFilter, type PageParams } from "./listQuery";
import { verifyTransaction } from "./paystack";
import { bookDate, holdDate, releaseHold } from "./dateLocks";
import { notifyBookingClash, notifyBookingConfirmed } from "./sms";
import { emailBookingClash, emailBookingConfirmed } from "./mailer";
import { findActivePackage } from "./packages";
import { depositFor } from "@/data/packages";
import type { BookingInput } from "./schemas";

// needs_refund: the deposit was paid, but the date was taken by someone else
// in the meantime (only possible if checkout outlasted the date hold).
export type BookingStatus = "pending" | "deposit_paid" | "failed" | "needs_refund";

export type Booking = BookingInput & {
  reference: string;
  packageName: string;
  price: number; // GHS
  depositPercent: number;
  deposit: number; // GHS
  status: BookingStatus;
  createdAt: Date;
  paidAt?: Date;
  payment?: { channel?: string; fees?: number | null };
};

let indexesEnsured = false;

export async function bookingsCollection() {
  const db = await getDb();
  const collection = db.collection<Booking>("bookings");
  if (!indexesEnsured) {
    await collection.createIndex({ reference: 1 }, { unique: true });
    await collection.createIndex({ createdAt: -1 });
    indexesEnsured = true;
  }
  return collection;
}

export type CreateBookingResult =
  | { ok: true; booking: Booking }
  | { ok: false; reason: "package_unavailable" | "date_taken" };

// Prices the booking from the package as it is right now (never from the
// browser), then holds the date so two people can never both reach checkout
// for it.
export async function createBooking(input: BookingInput): Promise<CreateBookingResult> {
  const pkg = await findActivePackage(input.packageId);
  if (!pkg) return { ok: false, reason: "package_unavailable" };

  const reference = `BMV-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
  if (!(await holdDate(input.date, reference))) return { ok: false, reason: "date_taken" };

  const booking: Booking = {
    ...input,
    reference,
    packageName: pkg.name,
    price: pkg.price,
    depositPercent: pkg.depositPercent,
    deposit: depositFor(pkg),
    status: "pending",
    createdAt: new Date(),
  };

  const collection = await bookingsCollection();
  await collection.insertOne(booking);
  return { ok: true, booking };
}

export async function cancelPendingBooking(booking: Booking) {
  const collection = await bookingsCollection();
  await collection.updateOne({ reference: booking.reference, status: "pending" }, { $set: { status: "failed" } });
  await releaseHold(booking.date, booking.reference);
}

// Confirms a booking's deposit with Paystack. Safe to call repeatedly and
// concurrently — from the callback page and the webhook — because the status
// only moves off "pending" once, and only that call sends the SMS.
export async function confirmBooking(reference: string) {
  const collection = await bookingsCollection();
  const booking = await collection.findOne({ reference });
  if (!booking) return null;
  if (booking.status !== "pending") return booking;

  const tx = await verifyTransaction(reference);
  const paidEnough = tx.currency === "GHS" && tx.amount >= Math.round(booking.deposit * 100);

  if (tx.status === "success" && paidEnough) {
    const gotDate = await bookDate(booking.date, reference);
    const updated = await collection.findOneAndUpdate(
      { reference, status: "pending" },
      {
        $set: {
          status: gotDate ? "deposit_paid" : "needs_refund",
          paidAt: new Date(),
          payment: { channel: tx.channel, fees: tx.fees },
        },
      },
      { returnDocument: "after" }
    );
    if (!updated) return collection.findOne({ reference }); // another call got here first
    await Promise.all(
      gotDate
        ? [notifyBookingConfirmed(updated), emailBookingConfirmed(updated)]
        : [notifyBookingClash(updated), emailBookingClash(updated)]
    );
    return updated;
  }

  if (tx.status === "failed") {
    await cancelPendingBooking(booking);
    return collection.findOne({ reference });
  }

  return booking;
}

// Called when the customer closes the checkout modal. Only releases the date
// once Paystack says nothing was paid: a Mobile Money prompt can still be
// awaiting approval, and then the hold stays until the webhook confirms it or
// the hold expires.
export async function abandonBooking(reference: string) {
  const collection = await bookingsCollection();
  const booking = await collection.findOne({ reference });
  if (!booking || booking.status !== "pending") return booking;

  const tx = await verifyTransaction(reference);
  if (tx.status === "success") return confirmBooking(reference);
  if (tx.status === "abandoned" || tx.status === "failed") {
    await cancelPendingBooking(booking);
    return collection.findOne({ reference });
  }
  return booking;
}

const searchableFields = ["name", "phone", "email", "reference", "packageName", "date", "location", "notes"];

/** Newest first. Unless `includeUnpaid`, only bookings that took a deposit. */
export async function listBookings({ q, includeUnpaid, page }: { q?: string; includeUnpaid: boolean; page: PageParams }) {
  const collection = await bookingsCollection();
  const filter: Filter<Booking> = {
    ...(includeUnpaid ? {} : { status: { $in: ["deposit_paid", "needs_refund"] } }),
    ...searchFilter(q, searchableFields),
  };
  const [bookings, total] = await Promise.all([
    collection
      .find(filter, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .skip(page.skip)
      .limit(page.pageSize)
      .toArray(),
    collection.countDocuments(filter),
  ]);
  return { bookings, total, pageSize: page.pageSize };
}
