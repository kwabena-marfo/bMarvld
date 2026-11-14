import nodemailer, { type SendMailOptions } from "nodemailer";
import { formatCedis } from "@/data/packages";
import type { Booking } from "./bookings";
import type { GalleryContact } from "./clientGalleries";
import { formatDate } from "./formatDate";

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
  ["Date", formatDate(b.date)],
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
    console.warn("SMTP not configured, skipping email:", mail.subject);
    return;
  }
  try {
    await transporter.sendMail({ from: `"B.Marvld" <${process.env.SMTP_USER}>`, ...mail });
  } catch (err) {
    console.error("Email failed:", err);
  }
}

export async function emailBookingConfirmed(b: Booking) {
  const date = formatDate(b.date);
  const summary = `${b.packageName}, ${date} at ${b.time}`;
  await Promise.all([
    trySend({
      to: b.email,
      subject: `Your B.Marvld session is confirmed for ${date}`,
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
      subject: `New booking from ${b.name}: ${summary}`,
      text: `New booking from ${b.name} (${b.phone}, ${b.email}) for ${summary} at ${b.location}. Deposit ${formatCedis(b.deposit)} paid. Ref ${b.reference}.${b.notes ? ` Notes: ${b.notes}` : ""}`,
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
  const date = formatDate(b.date);
  await Promise.all([
    trySend({
      to: b.email,
      subject: `About your B.Marvld booking on ${date}`,
      text: `Hi ${b.name}, we received your ${formatCedis(b.deposit)} deposit (Ref ${b.reference}), but ${date} was just taken. B.Marvld will contact you shortly to reschedule or refund.`,
      html: brandedEmail(
        "We need to reschedule",
        `Hi ${escape(b.name)}, we received your deposit, but ${date} was booked by someone else moments before your payment completed.`,
        bookingRows(b),
        "B.Marvld will contact you shortly to pick a new date or refund your deposit in full."
      ),
    }),
    trySend({
      to: adminEmails(),
      replyTo: b.email,
      subject: `ACTION NEEDED: ${b.name} paid for a taken date (${date})`,
      text: `${b.name} (${b.phone}, ${b.email}) paid ${formatCedis(b.deposit)} for ${date}, but that date is already taken. Reschedule or refund. Ref ${b.reference}.`,
      html: brandedEmail(
        "Action needed: date clash",
        "This client paid a deposit for a date that's already booked. Reschedule or refund them.",
        [...clientRows(b), ...bookingRows(b)],
        "Reply to this email to contact the client."
      ),
    }),
  ]);
}

// ------------------------------------------------------- client galleries ----

const linkButton = (url: string, label: string) =>
  `<p style="margin: 24px 0;"><a href="${url}" style="background: #ffc800; color: #050505; padding: 12px 20px; font-weight: 700; text-decoration: none; letter-spacing: 1px;">${label}</a></p>`;

export async function emailProofLink(g: GalleryContact, url: string, expiresAt: Date, maxSelections: number | null) {
  const pick = maxSelections ? `your ${maxSelections} favourites` : "your favourites";
  await trySend({
    to: g.clientEmail,
    subject: `Your B.Marvld photos are ready to choose from`,
    text: `Hi ${g.clientName}, your ${g.title} photos are ready. Pick ${pick} here: ${url} (open until ${formatDate(expiresAt)}).`,
    html: brandedEmail(
      "Your photos are ready to choose from",
      `Hi ${escape(g.clientName)}, the photos from your ${escape(g.title)} are ready. Tap the heart on ${pick} and send your selection. We'll edit those for you.${linkButton(url, "Choose your photos")}`,
      [["Link open until", formatDate(expiresAt)]],
      "These previews carry a watermark; your edited photos come without one. ...be marveled"
    ),
  });
}

export async function emailFinalLink(g: GalleryContact, url: string, expiresAt: Date) {
  await trySend({
    to: g.clientEmail,
    subject: `Your edited B.Marvld photos are ready`,
    text: `Hi ${g.clientName}, your edited ${g.title} photos are ready to view and download: ${url} (available until ${formatDate(expiresAt)}).`,
    html: brandedEmail(
      "Your edited photos are ready",
      `Hi ${escape(g.clientName)}, your edited photos from your ${escape(g.title)} are ready to view and download.${linkButton(url, "See your photos")}`,
      [["Available until", formatDate(expiresAt)]],
      "Download them before the link closes. Thank you for choosing B.Marvld. ...be marveled"
    ),
  });
}

export async function emailSelectionSubmitted(g: { clientName: string; title: string; count: number }, adminUrl: string) {
  await trySend({
    to: adminEmails(),
    subject: `${g.clientName} picked ${g.count} photos from ${g.title}`,
    text: `${g.clientName} has sent their selection of ${g.count} photos for ${g.title}: ${adminUrl}`,
    html: brandedEmail(
      "A client sent their selection",
      `${escape(g.clientName)} picked ${g.count} photos from ${escape(g.title)}.${linkButton(adminUrl, "See the selection")}`,
      [],
      "The admin page lists the original file names to edit."
    ),
  });
}
