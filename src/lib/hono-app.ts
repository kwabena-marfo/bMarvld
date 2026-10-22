import { Hono } from "hono";
import { z } from "zod";
import {
  blockDateSchema,
  bookingSchema,
  emailSchema,
  loginCodeSchema,
  packageSchema,
  photoDetailsSchema,
} from "./schemas";
import { cancelPendingBooking, confirmBooking, createBooking, listBookings } from "./bookings";
import { blockDate, unavailableDates, unblockDate, upcomingLocks } from "./dateLocks";
import { initializeTransaction, isValidWebhookSignature, paystackErrorMessage } from "./paystack";
import { checkLoginCode, endSession, requireAdmin, sendLoginCode, startSession } from "./adminAuth";
import { deleteImage, getUploadedImage, signUpload } from "./cloudinary";
import { addPhoto, listPhotos, removePhoto } from "./photos";
import {
  createPackage,
  deletePackage,
  listPackages,
  reorderPackages,
  updatePackage,
} from "./packages";

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

// First message per field, in the shape the forms map onto react-hook-form's setError.
function fieldErrors(error: z.ZodError) {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    errors[String(issue.path[0])] ??= issue.message;
  }
  return errors;
}

app.get("/availability", async (c) => {
  return c.json({ unavailableDates: await unavailableDates() });
});

app.get("/packages", async (c) => {
  return c.json({ packages: await listPackages({ activeOnly: true }) });
});

// Creates a pending booking (holding the date) and starts a Paystack checkout
// for the package's deposit. The booking only becomes confirmed once the
// payment is verified.
app.post("/bookings", async (c) => {
  const parsed = bookingSchema.safeParse(await readJson(c));
  if (!parsed.success) {
    return c.json({ error: "Please fix the highlighted fields", fieldErrors: fieldErrors(parsed.error) }, 400);
  }

  const result = await createBooking(parsed.data);
  if (!result.ok) {
    return result.reason === "date_taken"
      ? c.json(
          {
            error: "That date is no longer available",
            fieldErrors: { date: "That date is no longer available — try another" },
          },
          409
        )
      : c.json(
          {
            error: "That package is no longer available",
            fieldErrors: { packageId: "That package is no longer available — choose another" },
          },
          409
        );
  }

  const { booking } = result;
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

app.post("/admin/login/code", async (c) => {
  const parsed = emailSchema.safeParse(await readJson(c));
  if (!parsed.success) return c.json({ error: "Enter a valid email" }, 400);

  const result = await sendLoginCode(parsed.data.email);
  if (!result.ok) return c.json({ error: result.error }, result.status);
  return c.json({ ok: true });
});

app.post("/admin/login/verify", async (c) => {
  const parsed = loginCodeSchema.safeParse(await readJson(c));
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

admin.get("/packages", async (c) => {
  return c.json({ packages: await listPackages({ activeOnly: false }) });
});

admin.post("/packages", async (c) => {
  const parsed = packageSchema.safeParse(await readJson(c));
  if (!parsed.success) {
    return c.json({ error: "Please fix the highlighted fields", fieldErrors: fieldErrors(parsed.error) }, 400);
  }
  return c.json({ package: await createPackage(parsed.data) });
});

// Partial updates, so the availability switch can send just { active }.
admin.patch("/packages/:id", async (c) => {
  const parsed = packageSchema.partial().safeParse(await readJson(c));
  if (!parsed.success) {
    return c.json({ error: "Please fix the highlighted fields", fieldErrors: fieldErrors(parsed.error) }, 400);
  }
  const pkg = await updatePackage(c.req.param("id"), parsed.data);
  if (!pkg) return c.json({ error: "Package not found" }, 404);
  return c.json({ package: pkg });
});

admin.delete("/packages/:id", async (c) => {
  if (!(await deletePackage(c.req.param("id")))) return c.json({ error: "Package not found" }, 404);
  return c.json({ ok: true });
});

admin.post("/packages/reorder", async (c) => {
  const parsed = z.object({ ids: z.array(z.string()).max(100) }).safeParse(await readJson(c));
  if (!parsed.success) return c.json({ error: "Invalid order" }, 400);
  await reorderPackages(parsed.data.ids);
  return c.json({ ok: true });
});

admin.get("/dates", async (c) => {
  return c.json({ dates: await upcomingLocks() });
});

admin.post("/dates/block", async (c) => {
  const parsed = blockDateSchema.safeParse(await readJson(c));
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

admin.post("/photos", async (c) => {
  const parsed = photoDetailsSchema.extend({ publicId: z.string().min(1) }).safeParse(await readJson(c));
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
