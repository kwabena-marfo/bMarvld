import { Receiver } from "@upstash/qstash";
import { Hono } from "hono";
import { z } from "zod";
import {
  blockDateSchema,
  bookingSchema,
  clientGallerySchema,
  emailSchema,
  loginCodeSchema,
  manualBookingSchema,
  packageSchema,
  photoDetailsSchema,
  shareLinkSchema,
} from "./schemas";
import {
  addPhoto as addClientPhoto,
  clearExpiredGalleries,
  createGallery,
  deleteGallery,
  finalPublicIds,
  galleriesToRemind,
  getGalleryForAdmin,
  listGalleries,
  markReminded,
  pickedPublicIds,
  removePhoto as removeClientPhoto,
  removePhotos as removeClientPhotos,
  reopenSelection,
  setFinalFeatured,
  setProofSelected,
  unmarkFeatured,
  shareLink,
  shareUrl,
  submitSelection,
  updateGallery,
  uploadFolderFor,
} from "./clientGalleries";
import { emailDeletionReminder, emailFinalLink, emailProofLink, emailSelectionSubmitted } from "./mailer";
import { textDeletionReminder, textFinalLink, textProofLink, textSelectionSubmitted } from "./sms";
import {
  abandonBooking,
  cancelPendingBooking,
  confirmBooking,
  createBooking,
  createManualBooking,
  deleteBooking,
  listBookings,
} from "./bookings";
import { formatCedis } from "@/data/packages";
import { blockDate, unavailableDates, unblockDate, upcomingLocks } from "./dateLocks";
import { initializeTransaction, isValidWebhookSignature, paystackErrorMessage } from "./paystack";
import { checkLoginCode, endSession, requireAdmin, sendLoginCode, startSession } from "./adminAuth";
import {
  deleteImage,
  deleteImages,
  getUploadedImage,
  privateZipUrl,
  signPrivateUpload,
  signUpload,
  uploadFolder,
  uploadFromUrl,
} from "./cloudinary";
import { checkSize, driveDownloadUrl, DriveError, getDriveFile, listDriveLink } from "./googleDrive";
import { addPhoto, listPhotos, removePhoto, removePhotos } from "./photos";
import { SITE_URL } from "./siteUrl";
import { pageParams } from "./listQuery";
import { listFeaturedForAdmin, removeFeatured } from "./featured";
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

// The site's public address, for links in payments, texts and emails. Production
// always uses the custom domain, whatever APP_URL says, so clients are never
// sent to a preview copy of the site.
const appUrl = (c: { req: { url: string } }) =>
  process.env.VERCEL_ENV === "production" ? SITE_URL : process.env.APP_URL || new URL(c.req.url).origin;

// A Drive or Cloudinary failure during an import, as a message for the admin.
function importError(err: unknown) {
  if (err instanceof DriveError) return err.message;
  const message = (err as { message?: unknown })?.message;
  console.error(err);
  // Cloudinary's message can quote the Drive download address, key included.
  return typeof message === "string" && message
    ? `Cloudinary: ${message.replace(/([?&]key=)[^&\s]+/g, "$1…")}`
    : "Import failed";
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
            fieldErrors: { date: "That date is no longer available. Try another" },
          },
          409
        )
      : c.json(
          {
            error: "That package is no longer available",
            fieldErrors: { packageId: "That package is no longer available. Choose another" },
          },
          409
        );
  }

  const { booking } = result;

  try {
    const checkout = await initializeTransaction({
      email: booking.email,
      amount: Math.round(booking.deposit * 100),
      reference: booking.reference,
      callback_url: `${appUrl(c)}/booking/confirm`,
      metadata: {
        name: booking.name,
        phone: booking.phone,
        package: booking.packageName,
        date: booking.date,
      },
    });
    // The form opens the checkout in Paystack's modal with the access code; the
    // hosted page at authorizationUrl is its fallback if the modal can't load.
    return c.json({
      ok: true,
      reference: booking.reference,
      accessCode: checkout.access_code,
      authorizationUrl: checkout.authorization_url,
    });
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

// The customer closed the Paystack modal: frees the date unless a payment is
// still going through.
app.post("/bookings/:reference/cancel", async (c) => {
  const booking = await abandonBooking(c.req.param("reference"));
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

admin.delete("/bookings/:reference", async (c) => {
  if (!(await deleteBooking(c.req.param("reference")))) return c.json({ error: "Booking not found" }, 404);
  return c.json({ ok: true });
});

// A booking entered by the admin for a client who paid outside the site.
admin.post("/bookings", async (c) => {
  const parsed = manualBookingSchema.safeParse(await readJson(c));
  if (!parsed.success) {
    return c.json({ error: "Please fix the highlighted fields", fieldErrors: fieldErrors(parsed.error) }, 400);
  }
  const result = await createManualBooking(parsed.data, c.get("adminEmail"));
  if (!result.ok) {
    const [field, message] =
      result.reason === "date_taken"
        ? ["date", "That date is already booked or blocked"]
        : result.reason === "amount_too_high"
          ? ["amountPaid", `More than the package price (${formatCedis(result.price ?? 0)})`]
          : ["packageId", "That package no longer exists"];
    return c.json({ error: message, fieldErrors: { [field]: message } }, result.reason === "amount_too_high" ? 400 : 409);
  }
  return c.json({ booking: result.booking });
});

// ?q= search, ?page= / ?pageSize= paging, ?all=1 to include unpaid and failed.
admin.get("/bookings", async (c) => {
  const { q, page, pageSize, all } = c.req.query();
  return c.json(await listBookings({ q, includeUnpaid: all === "1", page: pageParams(page, pageSize) }));
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

// ---------------------------------------------------- Google Drive import ----
// The browser lists a pasted link, then imports its photos a few at a time;
// each import is Cloudinary fetching one photo from Drive.

admin.post("/drive/list", async (c) => {
  const body = z.object({ link: z.string().min(1).max(2000) }).safeParse(await readJson(c));
  if (!body.success) return c.json({ error: "Paste a Google Drive folder or photo link" }, 400);
  try {
    return c.json(await listDriveLink(body.data.link));
  } catch (err) {
    return c.json({ error: importError(err) }, 400);
  }
});

const driveFileId = z.object({ fileId: z.string().min(1).max(200) });

admin.post("/photos/drive", async (c) => {
  const parsed = photoDetailsSchema.extend(driveFileId.shape).safeParse(await readJson(c));
  if (!parsed.success) return c.json({ error: "Invalid photo details" }, 400);
  try {
    const file = await getDriveFile(parsed.data.fileId);
    checkSize(file);
    const image = await uploadFromUrl(driveDownloadUrl(file.id), { folder: uploadFolder });
    const id = await addPhoto({
      ...image,
      alt: parsed.data.alt || `${parsed.data.category} by B.Marvld`,
      category: parsed.data.category,
    });
    return c.json({ ok: true, id });
  } catch (err) {
    return c.json({ error: importError(err) }, 400);
  }
});

const bulkIds = z.object({ ids: z.array(z.string().min(1).max(100)).min(1).max(1000) });

admin.post("/photos/delete", async (c) => {
  const body = bulkIds.safeParse(await readJson(c));
  if (!body.success) return c.json({ error: "Choose photos to delete" }, 400);
  const publicIds = await removePhotos(body.data.ids);
  await deleteImages(publicIds);
  return c.json({ deleted: publicIds.length });
});

admin.delete("/photos/:id", async (c) => {
  const publicId = await removePhoto(c.req.param("id"));
  if (!publicId) return c.json({ error: "Photo not found" }, 404);
  await deleteImage(publicId);
  return c.json({ ok: true });
});

// ------------------------------------------------------- client galleries ----

const photoKind = z.enum(["proofs", "finals"]);

admin.get("/clients", async (c) => {
  const { q, page, pageSize } = c.req.query();
  return c.json(await listGalleries({ q, page: pageParams(page, pageSize) }));
});

admin.post("/clients", async (c) => {
  const parsed = clientGallerySchema.safeParse(await readJson(c));
  if (!parsed.success) {
    return c.json({ error: "Please fix the highlighted fields", fieldErrors: fieldErrors(parsed.error) }, 400);
  }
  return c.json({ id: await createGallery(parsed.data) });
});

admin.get("/clients/:id", async (c) => {
  const gallery = await getGalleryForAdmin(c.req.param("id"), appUrl(c));
  if (!gallery) return c.json({ error: "Gallery not found" }, 404);
  return c.json({ gallery });
});

admin.patch("/clients/:id", async (c) => {
  const parsed = clientGallerySchema.partial().safeParse(await readJson(c));
  if (!parsed.success) {
    return c.json({ error: "Please fix the highlighted fields", fieldErrors: fieldErrors(parsed.error) }, 400);
  }
  if (!(await updateGallery(c.req.param("id"), parsed.data))) return c.json({ error: "Gallery not found" }, 404);
  return c.json({ ok: true });
});

admin.delete("/clients/:id", async (c) => {
  if (!(await deleteGallery(c.req.param("id")))) return c.json({ error: "Gallery not found" }, 404);
  return c.json({ ok: true });
});

admin.post("/clients/:id/:kind{proofs|finals}/sign", (c) => {
  const kind = photoKind.safeParse(c.req.param("kind"));
  const folder = kind.success && uploadFolderFor(c.req.param("id"), kind.data);
  if (!folder) return c.json({ error: "Gallery not found" }, 404);
  return c.json(signPrivateUpload(folder));
});

admin.post("/clients/:id/:kind{proofs|finals}", async (c) => {
  const kind = photoKind.safeParse(c.req.param("kind"));
  const body = z.object({ publicId: z.string().min(1), name: z.string().max(200) }).safeParse(await readJson(c));
  if (!kind.success || !body.success) return c.json({ error: "Invalid photo" }, 400);
  const photo = await addClientPhoto(c.req.param("id"), kind.data, body.data.publicId, body.data.name);
  if (!photo) return c.json({ error: "Upload not found on Cloudinary" }, 400);
  return c.json({ ok: true });
});

admin.post("/clients/:id/:kind{proofs|finals}/drive", async (c) => {
  const kind = photoKind.safeParse(c.req.param("kind"));
  const body = driveFileId.safeParse(await readJson(c));
  if (!kind.success || !body.success) return c.json({ error: "Invalid photo" }, 400);
  const folder = uploadFolderFor(c.req.param("id"), kind.data);
  if (!folder) return c.json({ error: "Gallery not found" }, 404);
  try {
    const file = await getDriveFile(body.data.fileId);
    checkSize(file, { proof: kind.data === "proofs" });
    const image = await uploadFromUrl(driveDownloadUrl(file.id), { folder, authenticated: true });
    const photo = await addClientPhoto(c.req.param("id"), kind.data, image.publicId, file.name);
    if (!photo) return c.json({ error: "Gallery not found" }, 404);
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ error: importError(err) }, 400);
  }
});

admin.post("/clients/:id/:kind{proofs|finals}/delete", async (c) => {
  const kind = photoKind.safeParse(c.req.param("kind"));
  const body = bulkIds.safeParse(await readJson(c));
  if (!kind.success || !body.success) return c.json({ error: "Choose photos to delete" }, 400);
  const deleted = await removeClientPhotos(c.req.param("id"), kind.data, body.data.ids);
  if (deleted === null) return c.json({ error: "Gallery not found" }, 404);
  return c.json({ deleted });
});

admin.delete("/clients/:id/:kind{proofs|finals}/:photoId", async (c) => {
  const kind = photoKind.safeParse(c.req.param("kind"));
  if (!kind.success || !(await removeClientPhoto(c.req.param("id"), kind.data, c.req.param("photoId")))) {
    return c.json({ error: "Photo not found" }, 404);
  }
  return c.json({ ok: true });
});

// Creates (or extends) the client's selection or delivery link, optionally
// texting and emailing it to them.
admin.post("/clients/:id/share/:link", async (c) => {
  const link = z.enum(["proof", "final"]).safeParse(c.req.param("link"));
  const body = shareLinkSchema.safeParse(await readJson(c));
  if (!link.success || !body.success) return c.json({ error: "Choose how many days the link stays open" }, 400);

  const current = await getGalleryForAdmin(c.req.param("id"), appUrl(c));
  if (!current) return c.json({ error: "Gallery not found" }, 404);
  if (link.data === "proof" ? !current.proofs.length : !current.finals.length) {
    return c.json({ error: `Upload ${link.data === "proof" ? "the proofs" : "the edited photos"} first` }, 400);
  }

  const g = (await shareLink(c.req.param("id"), link.data, body.data.days))!;
  const { token, expiresAt } = link.data === "proof" ? g.proofLink! : g.finalLink!;
  const url = shareUrl(appUrl(c), link.data, token);
  if (body.data.notify) {
    await Promise.all(
      link.data === "proof"
        ? [textProofLink(g, url, expiresAt, g.maxSelections), emailProofLink(g, url, expiresAt, g.maxSelections)]
        : [textFinalLink(g, url, expiresAt), emailFinalLink(g, url, expiresAt)]
    );
  }
  return c.json({ url, expiresAt });
});

admin.post("/clients/:id/reopen", async (c) => {
  if (!(await reopenSelection(c.req.param("id")))) return c.json({ error: "Gallery not found" }, 404);
  return c.json({ ok: true });
});

// Client favourites shown on the home page.
admin.get("/featured", async (c) => {
  const { q, page, pageSize } = c.req.query();
  return c.json(await listFeaturedForAdmin({ q, page: pageParams(page, pageSize, 24) }));
});

admin.post("/featured/delete", async (c) => {
  const body = bulkIds.safeParse(await readJson(c));
  if (!body.success) return c.json({ error: "Choose photos to remove" }, 400);
  let deleted = 0;
  for (const id of body.data.ids) {
    const removed = await removeFeatured(id);
    if (!removed) continue;
    await unmarkFeatured(removed.galleryId, removed.finalId);
    deleted++;
  }
  return c.json({ deleted });
});

admin.delete("/featured/:id", async (c) => {
  const removed = await removeFeatured(c.req.param("id"));
  if (!removed) return c.json({ error: "Photo not found" }, 404);
  await unmarkFeatured(removed.galleryId, removed.finalId);
  return c.json({ ok: true });
});

// The client's picks as a zip of the clean (unwatermarked) proofs.
admin.get("/clients/:id/picks/zip", async (c) => {
  const picks = await pickedPublicIds(c.req.param("id"));
  if (!picks) return c.json({ error: "Gallery not found" }, 404);
  if (!picks.publicIds.length) return c.json({ error: "The client hasn't picked any photos yet" }, 400);
  return c.redirect(privateZipUrl(picks.publicIds, picks.title));
});

app.route("/admin", admin);

// The client's side, reached through the unguessable token in their link.

app.post("/proofs/:token/select", async (c) => {
  const body = z.object({ photoId: z.string().min(1), selected: z.boolean() }).safeParse(await readJson(c));
  if (!body.success) return c.json({ error: "Invalid request" }, 400);
  const result = await setProofSelected(c.req.param("token"), body.data.photoId, body.data.selected);
  if (!result.ok) return c.json({ error: result.error }, 409);
  return c.json({ selected: result.selected });
});

// Hourly clean-up, called by an Upstash QStash schedule (`npm run qstash:schedule`).
// Public, so the request must carry QStash's signature for this exact URL; the
// signing keys are per Upstash account, and the URL check stops a message meant
// for another app on the same account being replayed here.
app.post("/cron/cleanup", async (c) => {
  const { QSTASH_CURRENT_SIGNING_KEY: current, QSTASH_NEXT_SIGNING_KEY: next } = process.env;
  if (!current || !next) return c.json({ error: "QStash signing keys aren't set" }, 500);
  const body = await c.req.text();
  const signature = c.req.header("Upstash-Signature") ?? "";
  const valid = await new Receiver({ currentSigningKey: current, nextSigningKey: next })
    .verify({ signature, body, url: c.req.url })
    .catch(() => false);
  if (!valid) return c.json({ error: "Invalid signature" }, 401);

  // Reminders first: a gallery due within the day is warned before anything is deleted.
  const due = await galleriesToRemind();
  for (const g of due) {
    const url = shareUrl(appUrl(c), "final", g.token);
    await Promise.all([textDeletionReminder(g.contact, url, g.expiresAt), emailDeletionReminder(g.contact, url, g.expiresAt)]);
    await markReminded(g.id);
  }
  const cleared = await clearExpiredGalleries();
  console.log(`Cleanup: ${due.length} reminders sent, ${cleared} galleries cleared`);
  return c.json({ reminded: due.length, cleared });
});

// The client stars an edit to have it featured on the site (or un-stars it).
app.post("/photos/:token/feature", async (c) => {
  const body = z.object({ photoId: z.string().min(1), featured: z.boolean() }).safeParse(await readJson(c));
  if (!body.success) return c.json({ error: "Invalid request" }, 400);
  const result = await setFinalFeatured(c.req.param("token"), body.data.photoId, body.data.featured);
  if (!result.ok) return c.json({ error: result.error }, 409);
  return c.json({ featured: result.featured });
});

app.post("/proofs/:token/submit", async (c) => {
  const g = await submitSelection(c.req.param("token"));
  if (!g) return c.json({ error: "Choose at least one photo first. If you have, this link has closed" }, 409);
  const adminUrl = `${appUrl(c)}/admin/clients/${g.id}`;
  await Promise.all([textSelectionSubmitted(g, adminUrl), emailSelectionSubmitted(g, adminUrl)]);
  return c.json({ ok: true });
});

app.get("/photos/:token/zip", async (c) => {
  const finals = await finalPublicIds(c.req.param("token"));
  if (!finals?.publicIds.length) return c.json({ error: "This link has closed" }, 404);
  return c.redirect(privateZipUrl(finals.publicIds, finals.title));
});

export default app;
