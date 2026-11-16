import { getDb } from "./mongodb";

// One document per calendar date, keyed by the date itself, so MongoDB's
// unique _id guarantees a date can only ever be held by one booking:
// - "hold":    someone is at Paystack checkout for it (expires after HOLD_MINUTES)
// - "booked":  the deposit was paid
// - "blocked": the admin closed the date
export type DateLock = {
  _id: string; // YYYY-MM-DD
  kind: "hold" | "booked" | "blocked";
  reference: string;
  expiresAt?: Date;
};

const HOLD_MINUTES = 30;

async function locksCollection() {
  const db = await getDb();
  return db.collection<DateLock>("dateLocks");
}

function isDuplicateKeyError(err: unknown) {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === 11000;
}

const today = () => new Date().toISOString().slice(0, 10);

// Dates the booking form must not offer: booked, blocked, or currently held.
export async function unavailableDates() {
  const locks = await locksCollection();
  const docs = await locks
    .find(
      {
        _id: { $gte: today() },
        $or: [{ kind: { $in: ["booked", "blocked"] } }, { expiresAt: { $gt: new Date() } }],
      },
      { projection: { _id: 1 } }
    )
    .toArray();
  return docs.map((d) => d._id);
}

// Reserves the date while the client pays. Takes over an expired hold, but
// never a live hold, a booking or a block.
export async function holdDate(date: string, reference: string) {
  const locks = await locksCollection();
  const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60_000);
  try {
    await locks.insertOne({ _id: date, kind: "hold", reference, expiresAt });
    return true;
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
  }
  const taken = await locks.findOneAndUpdate(
    { _id: date, kind: "hold", expiresAt: { $lte: new Date() } },
    { $set: { reference, expiresAt } }
  );
  return !!taken;
}

// Turns this booking's hold into a confirmed booking. Also succeeds if the
// hold lapsed but nobody else claimed the date. Returns false only when the
// date now belongs to someone else (or was blocked) — a paid-but-clashing
// booking that needs a refund or reschedule.
export async function bookDate(date: string, reference: string) {
  const locks = await locksCollection();
  try {
    await locks.updateOne(
      { _id: date, $or: [{ reference }, { kind: "hold", expiresAt: { $lte: new Date() } }] },
      { $set: { kind: "booked", reference }, $unset: { expiresAt: "" } },
      { upsert: true }
    );
    return true;
  } catch (err) {
    if (isDuplicateKeyError(err)) return false;
    throw err;
  }
}

export async function releaseHold(date: string, reference: string) {
  const locks = await locksCollection();
  await locks.deleteOne({ _id: date, reference, kind: "hold" });
}

// A deleted booking gives its date back, whether it was paid (booked) or still
// at checkout (hold). Another booking's or a block on the same day is untouched.
export async function releaseBookingDate(date: string, reference: string) {
  const locks = await locksCollection();
  await locks.deleteOne({ _id: date, reference, kind: { $in: ["hold", "booked"] } });
}

export async function blockDate(date: string) {
  const locks = await locksCollection();
  try {
    await locks.insertOne({ _id: date, kind: "blocked", reference: "ADMIN" });
    return true;
  } catch (err) {
    if (isDuplicateKeyError(err)) return false;
    throw err;
  }
}

export async function unblockDate(date: string) {
  const locks = await locksCollection();
  const res = await locks.deleteOne({ _id: date, kind: "blocked" });
  return res.deletedCount === 1;
}

export async function upcomingLocks() {
  const locks = await locksCollection();
  return locks
    .find({ _id: { $gte: today() }, kind: { $in: ["booked", "blocked"] } })
    .sort({ _id: 1 })
    .toArray();
}
