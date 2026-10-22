import crypto from "crypto";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";
import { getDb } from "./mongodb";
import { sendLoginCodeEmail } from "./mailer";

// Admins sign in with a 6-digit code emailed to one of the addresses in
// ADMIN_EMAILS, then hold a signed, HTTP-only session cookie.
const COOKIE = "bmarvld_admin";
const SESSION_DAYS = 7;
const CODE_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_SECONDS = 60;

type LoginCode = {
  _id: string; // email — one live code per admin
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  sentAt: Date;
};

function secret() {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error("Missing ADMIN_SESSION_SECRET environment variable");
  return s;
}

export function isAdminEmail(email: string) {
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email);
}

// Keyed with the session secret, so a database leak doesn't expose live codes.
const hashCode = (email: string, code: string) =>
  crypto.createHmac("sha256", secret()).update(`${email}:${code}`).digest("hex");

async function codesCollection() {
  const db = await getDb();
  return db.collection<LoginCode>("loginCodes");
}

export type SendCodeResult = { ok: true } | { ok: false; error: string; status: 403 | 429 };

export async function sendLoginCode(email: string): Promise<SendCodeResult> {
  // An internal tool for a handful of people, so saying "not an admin" up
  // front is friendlier than pretending a code was sent.
  if (!isAdminEmail(email)) return { ok: false, error: "That email isn't an admin", status: 403 };

  const codes = await codesCollection();
  const existing = await codes.findOne({ _id: email });
  if (existing && Date.now() - existing.sentAt.getTime() < RESEND_SECONDS * 1000) {
    return { ok: false, error: "A code was just sent — wait a minute before requesting another", status: 429 };
  }

  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  await codes.replaceOne(
    { _id: email },
    {
      codeHash: hashCode(email, code),
      expiresAt: new Date(Date.now() + CODE_MINUTES * 60_000),
      attempts: 0,
      sentAt: new Date(),
    },
    { upsert: true }
  );
  await sendLoginCodeEmail(email, code, CODE_MINUTES);
  return { ok: true };
}

// Each code is single-use and dies after MAX_ATTEMPTS wrong guesses.
export async function checkLoginCode(email: string, code: string) {
  const codes = await codesCollection();
  const entry = await codes.findOneAndUpdate(
    { _id: email, expiresAt: { $gt: new Date() }, attempts: { $lt: MAX_ATTEMPTS } },
    { $inc: { attempts: 1 } },
    { returnDocument: "after" }
  );
  if (!entry) return false;

  const expected = Buffer.from(entry.codeHash);
  const given = Buffer.from(hashCode(email, code));
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return false;

  await codes.deleteOne({ _id: email });
  return true;
}

export async function startSession(c: Context, email: string) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400;
  const token = await sign({ role: "admin", email, exp }, secret(), "HS256");
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export function endSession(c: Context) {
  deleteCookie(c, COOKIE, { path: "/" });
}

// Also re-checks ADMIN_EMAILS, so removing someone from the list locks them
// out immediately rather than when their session expires.
export const requireAdmin = createMiddleware<{ Variables: { adminEmail: string } }>(async (c, next) => {
  const token = getCookie(c, COOKIE);
  let email: string;
  try {
    if (!token) throw new Error();
    const payload = await verify(token, secret(), "HS256");
    if (payload.role !== "admin" || typeof payload.email !== "string" || !isAdminEmail(payload.email)) {
      throw new Error();
    }
    email = payload.email;
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("adminEmail", email);
  await next();
});
