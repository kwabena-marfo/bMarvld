import axios from "axios";
import { formatCedis } from "@/data/packages";
import type { Booking } from "./bookings";
import type { GalleryContact } from "./clientGalleries";
import { formatDate } from "./formatDate";

const ENDPOINT = "https://api.mnotify.com/api/sms/quick";

// The sender name must be approved on the mNotify dashboard first, or every
// send fails.
const SENDER = process.env.MNOTIFY_SENDER_ID || "BMarvld";

export async function sendSMS(recipients: string[], message: string) {
  if (!process.env.MNOTIFY_KEY) {
    console.warn("MNOTIFY_KEY not set, skipping SMS:", message);
    return;
  }
  const { data } = await axios.post(`${ENDPOINT}?key=${process.env.MNOTIFY_KEY}`, {
    // mNotify wants international numbers as bare digits ("233…"); Ghana's
    // local "024…" form passes through unchanged.
    recipient: recipients.map((r) => r.replace(/[\s-]/g, "").replace(/^\+/, "")),
    sender: SENDER,
    message,
  });
  if (data.code !== "2000") {
    throw new Error(data.message || "SMS send failed");
  }
}

// Notifications are best-effort: a failed text must never undo or block a
// confirmed payment, so errors are logged rather than thrown.
async function trySend(recipients: (string | undefined)[], message: string) {
  const to = recipients.filter((r): r is string => !!r);
  if (!to.length) return;
  try {
    await sendSMS(to, message);
  } catch (err) {
    console.error("SMS failed:", err);
  }
}

// Everyone alerted about bookings, as a comma-separated list like ADMIN_EMAILS.
const adminPhones = () =>
  (process.env.ADMIN_PHONES ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

const firstName = (b: Booking) => b.name.split(" ")[0];

export async function notifyBookingConfirmed(b: Booking) {
  await Promise.all([
    trySend(
      [b.phone],
      `Hi ${firstName(b)}, your B.Marvld ${b.packageName} session on ${formatDate(b.date)} at ${b.time} is confirmed. ` +
        `Deposit of ${formatCedis(b.deposit)} received; balance ${formatCedis(b.price - b.deposit)} is due on the day. ` +
        `Ref: ${b.reference}. ...be marveled`
    ),
    trySend(
      adminPhones(),
      `New booking from ${b.name} (${b.phone}) for ${b.packageName}, ${formatDate(b.date)} ${b.time} at ${b.location}. ` +
        `Deposit ${formatCedis(b.deposit)} paid. Ref ${b.reference}`
    ),
  ]);
}

export async function notifyBookingClash(b: Booking) {
  await Promise.all([
    trySend(
      [b.phone],
      `Hi ${firstName(b)}, we received your ${formatCedis(b.deposit)} deposit (Ref ${b.reference}), but ${formatDate(b.date)} ` +
        `was just taken. B.Marvld will call you shortly to reschedule or refund.`
    ),
    trySend(
      adminPhones(),
      `ACTION NEEDED: ${b.name} (${b.phone}) paid ${formatCedis(b.deposit)} for ${formatDate(b.date)}, but that date is already ` +
        `taken. Reschedule or refund. Ref ${b.reference}`
    ),
  ]);
}

// ------------------------------------------------------- client galleries ----

export async function textProofLink(g: GalleryContact, url: string, expiresAt: Date, maxSelections: number | null) {
  const pick = maxSelections ? `your ${maxSelections} favourites` : "your favourites";
  await trySend(
    [g.clientPhone],
    `Hi ${g.clientName.split(" ")[0]}, your B.Marvld photos are ready! Pick ${pick} here: ${url} ` +
      `(open until ${formatDate(expiresAt)}). ...be marveled`
  );
}

export async function textFinalLink(g: GalleryContact, url: string, expiresAt: Date) {
  await trySend(
    [g.clientPhone],
    `Hi ${g.clientName.split(" ")[0]}, your edited B.Marvld photos are ready: ${url} ` +
      `Please download them by ${formatDate(expiresAt)}, when they're removed from our gallery. ...be marveled`
  );
}

export async function textDeletionReminder(g: GalleryContact, url: string, expiresAt: Date) {
  await trySend(
    [g.clientPhone],
    `Hi ${g.clientName.split(" ")[0]}, a reminder from B.Marvld: your photos are removed from our gallery on ` +
      `${formatDate(expiresAt)}. If you haven't yet, download them now: ${url}`
  );
}

export async function textSelectionSubmitted(g: { clientName: string; title: string; count: number }, adminUrl: string) {
  await trySend(adminPhones(), `${g.clientName} picked ${g.count} photos from ${g.title}. See them: ${adminUrl}`);
}
