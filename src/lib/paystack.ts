import crypto from "crypto";
import axios from "axios";

const paystack = axios.create({
  baseURL: "https://api.paystack.co",
  headers: {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    "Content-Type": "application/json",
  },
});

export async function initializeTransaction(data: {
  email: string;
  amount: number; // pesewas
  reference: string;
  callback_url: string;
  metadata?: Record<string, unknown>;
}) {
  const res = await paystack.post("/transaction/initialize", { currency: "GHS", ...data });

  return res.data?.data as {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export async function verifyTransaction(reference: string) {
  const res = await paystack.get(`/transaction/verify/${encodeURIComponent(reference)}`);

  return res.data?.data as {
    status: "success" | "failed" | "abandoned";
    reference: string;
    amount: number; // pesewas
    currency: string;
    fees?: number | null;
    channel?: string;
  };
}

export function isValidWebhookSignature(rawBody: string, signature: string | undefined) {
  if (!signature) return false;
  const hash = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY || "")
    .update(rawBody)
    .digest("hex");
  return hash.length === signature.length && crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
}

// Paystack's own error text is far more useful than axios's
// "Request failed with status code 400".
export function paystackErrorMessage(err: unknown, fallback: string) {
  const e = err as { response?: { data?: { message?: string } }; message?: string };
  return e?.response?.data?.message || e?.message || fallback;
}
