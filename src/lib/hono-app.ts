import { Hono } from "hono";
import { z } from "zod";
import { bookingSchema } from "./schemas";
import { cancelPendingBooking, confirmBooking, createBooking, listBookings } from "./bookings";
import { blockDate, unavailableDates, unblockDate, upcomingLocks } from "./dateLocks";
import { initializeTransaction, isValidWebhookSignature, paystackErrorMessage } from "./paystack";
import { checkLoginCode, endSession, requireAdmin, sendLoginCode, startSession } from "./adminAuth";
import { deleteImage, getUploadedImage, signUpload } from "./cloudinary";
import { addPhoto, listPhotos, removePhoto } from "./photos";
import { photoCategories } from "@/data/gallery";

const app = new Hono().basePath("/api");

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Something went wrong. Please try again." }, 500);
});

async function readJson(c: { req: { json: () => Promise<unknown> } }) {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
}

app.get("/availability", async (c) => {
  return c.json({ unavailableDates: await unavailableDates() });
});

const dateTakenResponse = {
  error: "That date is no longer available",
  fieldErrors: { date: "That date is no longer available — try another" },
};

// Creates a pending booking (holding the date) and starts a Paystack checkout
// for the 50% deposit. The booking only becomes confirmed once the payment is
// verified.
app.post("/bookings", async (c) => {
  const body = await readJson(c);
  if (body === undefined) return c.json({ error: "Invalid request body" }, 400);

  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      fieldErrors[key] ??= issue.message;
    }
    return c.json({ error: "Please fix the highlighted fields", fieldErrors }, 400);
  }

  const booking = await createBooking(parsed.data);
  if (!booking) return c.json(dateTakenResponse, 409);

  const appUrl = process.env.APP_URL || new URL(c.req.url).origin;

  try {
    const checkout = await initializeTransaction({
      email: booking.email,
      amount: Math.round(booking.deposit * 100),
      reference: booking.reference,
      callback_url: `${appUrl}/booking/confirm`,
      metadata: {
        name: booking.name,
        phone: booking.phone,
        package: booking.packageName,
        date: booking.date,
      },
    });
    return c.json({ ok: true, reference: booking.reference, authorizationUrl: checkout.authorization_url });
  } catch (err) {
    await cancelPendingBooking(booking);
    return c.json({ error: paystackErrorMessage(err, "Could not start payment") }, 502);
  }
});

app.get("/bookings/:reference/verify", async (c) => {
  const booking = await confirmBooking(c.req.param("reference"));
  if (!booking) return c.json({ error: "Booking not found" }, 404);
  return c.json({ reference: booking.reference, status: booking.status });
});

app.post("/paystack/webhook", async (c) => {
  const rawBody = await c.req.text();
  if (!isValidWebhookSignature(rawBody, c.req.header("x-paystack-signature"))) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  const event = JSON.parse(rawBody) as { event: string; data: { reference: string } };
  if (event.event === "charge.success") {
    await confirmBooking(event.data.reference);
  }

  return c.json({ received: true });
});

// ---------------------------------------------------------------- admin ----

const emailSchema = z.object({ email: z.email().trim().toLowerCase() });

app.post("/admin/login/code", async (c) => {
  const parsed = emailSchema.safeParse(await readJson(c));
  if (!parsed.success) return c.json({ error: "Enter a valid email" }, 400);

  const result = await sendLoginCode(parsed.data.email);
  if (!result.ok) return c.json({ error: result.error }, result.status);
  return c.json({ ok: true });
});

const verifyCodeSchema = emailSchema.extend({ code: z.string().trim().regex(/^\d{6}$/) });

app.post("/admin/login/verify", async (c) => {
  const parsed = verifyCodeSchema.safeParse(await readJson(c));
  if (!parsed.success) return c.json({ error: "Enter the 6-digit code from your email" }, 400);

  if (!(await checkLoginCode(parsed.data.email, parsed.data.code))) {
    return c.json({ error: "That code is wrong or has expired" }, 401);
  }
  await startSession(c, parsed.data.email);
  return c.json({ ok: true });
});

app.post("/admin/logout", (c) => {
  endSession(c);
  return c.json({ ok: true });
});

const admin = new Hono<{ Variables: { adminEmail: string } }>();
admin.use(requireAdmin);

admin.get("/me", (c) => c.json({ email: c.get("adminEmail") }));

admin.get("/bookings", async (c) => {
  return c.json({ bookings: await listBookings() });
});

admin.get("/dates", async (c) => {
  return c.json({ dates: await upcomingLocks() });
});

const dateSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

admin.post("/dates/block", async (c) => {
  const parsed = dateSchema.safeParse(await readJson(c));
  if (!parsed.success) return c.json({ error: "Choose a valid date" }, 400);
  if (!(await blockDate(parsed.data.date))) {
    return c.json({ error: "That date is already booked, blocked or being paid for" }, 409);
  }
  return c.json({ ok: true });
});

admin.delete("/dates/block/:date", async (c) => {
  if (!(await unblockDate(c.req.param("date")))) {
    return c.json({ error: "That date isn't blocked" }, 404);
  }
  return c.json({ ok: true });
});

admin.get("/photos", async (c) => {
  return c.json({ photos: await listPhotos() });
});

admin.post("/photos/sign", (c) => c.json(signUpload()));

const photoSchema = z.object({
  publicId: z.string().min(1),
  alt: z.string().trim().max(200).default(""),
  category: z.enum(photoCategories),
});

admin.post("/photos", async (c) => {
  const parsed = photoSchema.safeParse(await readJson(c));
  if (!parsed.success) return c.json({ error: "Invalid photo details" }, 400);

  const image = await getUploadedImage(parsed.data.publicId);
  if (!image) return c.json({ error: "Upload not found on Cloudinary" }, 400);

  const id = await addPhoto({
    publicId: parsed.data.publicId,
    url: image.url,
    width: image.width,
    height: image.height,
    alt: parsed.data.alt || `${parsed.data.category} by B.Marvld`,
    category: parsed.data.category,
  });
  return c.json({ ok: true, id });
});

admin.delete("/photos/:id", async (c) => {
  const publicId = await removePhoto(c.req.param("id"));
  if (!publicId) return c.json({ error: "Photo not found" }, 404);
  await deleteImage(publicId);
  return c.json({ ok: true });
});

app.route("/admin", admin);

export default app;
