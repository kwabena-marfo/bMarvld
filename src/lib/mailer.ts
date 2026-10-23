import nodemailer, { type SendMailOptions } from "nodemailer";
import { formatCedis } from "@/data/packages";
import type { Booking } from "./bookings";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendLoginCodeEmail(email: string, code: string, minutes: number) {
  await transporter.sendMail({
    from: `"B.Marvld" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `${code} is your B.Marvld admin login code`,
    text: `Your B.Marvld admin login code is ${code}. It expires in ${minutes} minutes.`,
    html: `
      <div style="font-family: sans-serif; max-width: 420px; margin: 0 auto; background: #050505; color: #f6e3c8; padding: 32px;">
        <p style="font-size: 22px; font-weight: 700; letter-spacing: 2px; margin: 0 0 24px;">B<span style="color: #ffc800;">.</span>MARVLD</p>
        <p>Your admin login code is:</p>
        <p style="font-size: 34px; font-weight: 700; letter-spacing: 8px; color: #ffc800;">${code}</p>
        <p style="color: #c9b8a0;">It expires in ${minutes} minutes. If you didn't try to sign in, you can ignore this email.</p>
      </div>
    `,
  });
}

export function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

// Booking fields are typed by the client, so they're escaped before going into HTML.
const escape = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

function brandedEmail(heading: string, intro: string, rows: [string, string][], footer: string) {
  const table = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding: 6px 16px 6px 0; color: #c9b8a0; vertical-align: top;">${label}</td><td style="padding: 6px 0;">${escape(value)}</td></tr>`
    )
    .join("");
  return `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; background: #050505; color: #f6e3c8; padding: 32px;">
      <p style="font-size: 22px; font-weight: 700; letter-spacing: 2px; margin: 0 0 24px;">B<span style="color: #ffc800;">.</span>MARVLD</p>
      <p style="font-size: 18px; font-weight: 700; color: #ffc800; margin: 0 0 12px;">${heading}</p>
      <p>${intro}</p>
      <table style="border-collapse: collapse; margin: 16px 0; font-size: 14px;">${table}</table>
      <p style="color: #c9b8a0;">${footer}</p>
    </div>
  `;
}

const bookingRows = (b: Booking): [string, string][] => [
  ["Reference", b.reference],
  ["Package", b.packageName],
  ["Date", b.date],
  ["Time", b.time],
  ["Location", b.location],
  ["Deposit paid", formatCedis(b.deposit)],
  ["Balance due", formatCedis(b.price - b.deposit)],
];

const clientRows = (b: Booking): [string, string][] => [
  ["Client", b.name],
  ["Phone", b.phone],
  ["Email", b.email],
  ...(b.notes ? [["Notes", b.notes] as [string, string]] : []),
];

// Best-effort, like the texts: a failed email must never undo a confirmed payment.
async function trySend(mail: SendMailOptions) {
  const to = [mail.to].flat().filter(Boolean);
  if (!to.length) return;
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("SMTP not configured — skipping email:", mail.subject);
    return;
  }
  try {
    await transporter.sendMail({ from: `"B.Marvld" <${process.env.SMTP_USER}>`, ...mail });
  } catch (err) {
    console.error("Email failed:", err);
  }
}

export async function emailBookingConfirmed(b: Booking) {
  const summary = `${b.packageName}, ${b.date} at ${b.time}`;
  await Promise.all([
    trySend({
      to: b.email,
      subject: `Your B.Marvld session is confirmed — ${b.date}`,
      text: `Hi ${b.name}, your ${summary} (${b.location}) is confirmed. Deposit ${formatCedis(b.deposit)} received; balance ${formatCedis(b.price - b.deposit)} is due on the day. Ref ${b.reference}.`,
      html: brandedEmail(
        "Your session is confirmed",
        `Hi ${escape(b.name)}, thank you for booking with B.Marvld. Here are your details:`,
        bookingRows(b),
        "The balance is due on the day of the shoot. Reply to this email if anything changes. ...be marveled"
      ),
    }),
    trySend({
      to: adminEmails(),
      replyTo: b.email,
      subject: `New booking: ${b.name} — ${summary}`,
      text: `New booking: ${b.name} (${b.phone}, ${b.email}) - ${summary} at ${b.location}. Deposit ${formatCedis(b.deposit)} paid. Ref ${b.reference}.${b.notes ? ` Notes: ${b.notes}` : ""}`,
      html: brandedEmail(
        "New booking",
        "A deposit has been paid and the date is now booked.",
        [...clientRows(b), ...bookingRows(b)],
        "Reply to this email to contact the client."
      ),
    }),
  ]);
}

export async function emailBookingClash(b: Booking) {
  await Promise.all([
    trySend({
      to: b.email,
      subject: `About your B.Marvld booking — ${b.date}`,
      text: `Hi ${b.name}, we received your ${formatCedis(b.deposit)} deposit (Ref ${b.reference}), but ${b.date} was just taken. B.Marvld will contact you shortly to reschedule or refund.`,
      html: brandedEmail(
        "We need to reschedule",
        `Hi ${escape(b.name)}, we received your deposit, but ${escape(b.date)} was booked by someone else moments before your payment completed.`,
        bookingRows(b),
        "B.Marvld will contact you shortly to pick a new date or refund your deposit in full."
      ),
    }),
    trySend({
      to: adminEmails(),
      replyTo: b.email,
      subject: `ACTION NEEDED: ${b.name} paid for a taken date (${b.date})`,
      text: `${b.name} (${b.phone}, ${b.email}) paid ${formatCedis(b.deposit)} for ${b.date}, but that date is already taken. Reschedule or refund. Ref ${b.reference}.`,
      html: brandedEmail(
        "Action needed: date clash",
        "This client paid a deposit for a date that's already booked. Reschedule or refund them.",
        [...clientRows(b), ...bookingRows(b)],
        "Reply to this email to contact the client."
      ),
    }),
  ]);
}
