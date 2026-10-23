import axios from "axios";
import { formatCedis } from "@/data/packages";
import type { Booking } from "./bookings";

const ENDPOINT = "https://api.mnotify.com/api/sms/quick";

// The sender name must be approved on the mNotify dashboard first, or every
// send fails.
const SENDER = process.env.MNOTIFY_SENDER_ID || "BMarvld";

export async function sendSMS(recipients: string[], message: string) {
  if (!process.env.MNOTIFY_KEY) {
    console.warn("MNOTIFY_KEY not set — skipping SMS:", message);
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
      `Hi ${firstName(b)}, your B.Marvld ${b.packageName} session on ${b.date} at ${b.time} is confirmed. ` +
        `Deposit of ${formatCedis(b.deposit)} received; balance ${formatCedis(b.price - b.deposit)} is due on the day. ` +
        `Ref: ${b.reference}. ...be marveled`
    ),
    trySend(
      adminPhones(),
      `New booking: ${b.name} (${b.phone}) - ${b.packageName}, ${b.date} ${b.time} at ${b.location}. ` +
        `Deposit ${formatCedis(b.deposit)} paid. Ref ${b.reference}`
    ),
  ]);
}

export async function notifyBookingClash(b: Booking) {
  await Promise.all([
    trySend(
      [b.phone],
      `Hi ${firstName(b)}, we received your ${formatCedis(b.deposit)} deposit (Ref ${b.reference}), but ${b.date} ` +
        `was just taken. B.Marvld will call you shortly to reschedule or refund.`
    ),
    trySend(
      adminPhones(),
      `ACTION NEEDED: ${b.name} (${b.phone}) paid ${formatCedis(b.deposit)} for ${b.date}, but that date is already ` +
        `taken. Reschedule or refund. Ref ${b.reference}`
    ),
  ]);
}
