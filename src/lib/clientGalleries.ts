import crypto from "crypto";
import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";
import { searchFilter, type PageParams } from "./listQuery";
import {
  clientsFolder,
  deleteImages,
  deletePrivateFolder,
  deletePrivateImage,
  getPrivateImage,
  privateDownloadUrl,
  privateImageUrl,
  publishPrivateImage,
} from "./cloudinary";
import { addFeatured, removeFeaturedCopy } from "./featured";
import type { ClientGalleryInput } from "./schemas";
import type { GalleryStatus } from "@/data/clientGalleries";

// A client's private gallery: the admin uploads proofs, the client picks their
// favourites through a temporary link (seeing only watermarked copies), the
// admin edits those and uploads the finals, and a second link delivers them.
export type ClientPhoto = {
  id: string;
  publicId: string;
  name: string; // the original file name, so the admin can find the photo to edit
  width: number;
  height: number;
  // When it was shot (camera data), for showing the gallery in shooting order.
  // Null: it has no camera data. Missing: not looked up yet (uploaded before this was recorded).
  takenAt?: Date | null;
};

type ShareLink = { token: string; expiresAt: Date };

type GalleryDoc = ClientGalleryInput & {
  proofs: ClientPhoto[];
  selected: string[]; // proof ids
  proofLink?: ShareLink;
  submittedAt?: Date; // the client sent their selection; it's locked until the admin reopens it
  finals: ClientPhoto[];
  finalLink?: ShareLink;
  deliveredAt?: Date;
  featured?: string[]; // final ids the client chose to have shown on the site
  reminderSentAt?: Date; // "your photos are deleted tomorrow", sent once per deadline
  clearedAt?: Date; // the delivery link closed and the photos were deleted from Cloudinary
  clearedPicks?: string[]; // file names the client had picked, kept as a record after clearing
  createdAt: Date;
  updatedAt: Date;
};

export type PhotoKind = "proofs" | "finals";

let indexesEnsured = false;

async function galleries() {
  const db = await getDb();
  const collection = db.collection<GalleryDoc>("clientGalleries");
  if (!indexesEnsured) {
    await collection.createIndex({ "proofLink.token": 1 }, { unique: true, sparse: true });
    await collection.createIndex({ "finalLink.token": 1 }, { unique: true, sparse: true });
    await collection.createIndex({ createdAt: -1 });
    indexesEnsured = true;
  }
  return collection;
}

const folderFor = (id: string, kind: PhotoKind) => `${clientsFolder}/${id}/${kind}`;
const newToken = () => crypto.randomBytes(18).toString("base64url");
const isLive = (link?: ShareLink) => !!link && link.expiresAt > new Date();
const byName = (a: ClientPhoto, b: ClientPhoto) => a.name.localeCompare(b.name, undefined, { numeric: true });

// Earliest shot first. Photos with no time go last, by file name, as do ties.
const byTime = (a: ClientPhoto, b: ClientPhoto) => {
  const ta = a.takenAt?.getTime();
  const tb = b.takenAt?.getTime();
  if (ta !== undefined && tb !== undefined && ta !== tb) return ta - tb;
  if (ta !== undefined && tb === undefined) return -1;
  if (ta === undefined && tb !== undefined) return 1;
  return byName(a, b);
};
const inShootingOrder = (photos: ClientPhoto[]) => [...photos].sort(byTime);

const BACKFILL = 60; // photos looked up per visit; Cloudinary allows a few hundred lookups an hour

/**
 * Galleries uploaded before shooting times were recorded: looks up a batch of
 * their photos' times on Cloudinary and saves them, so the gallery settles into
 * shooting order over a visit or two. Changes `g` in place too.
 */
async function fillShootingTimes(g: GalleryDoc & { _id: ObjectId }) {
  const missing = (["proofs", "finals"] as const)
    .flatMap((kind) => g[kind].filter((p) => p.takenAt === undefined).map((photo) => ({ kind, photo })))
    .slice(0, BACKFILL);
  if (!missing.length) return;

  const queue = [...missing];
  const found: typeof missing = [];
  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const image = await getPrivateImage(next.photo.publicId, folderFor(g._id.toString(), next.kind)).catch(() => null);
      if (!image) continue; // e.g. over Cloudinary's hourly limit: tried again next visit
      next.photo.takenAt = image.takenAt;
      found.push(next);
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  if (!found.length) return;

  await (await galleries()).bulkWrite(
    found.map(({ kind, photo }) => ({
      updateOne: {
        filter: { _id: g._id },
        update: { $set: { [`${kind}.$[p].takenAt`]: photo.takenAt } },
        arrayFilters: [{ "p.id": photo.id }],
      },
    }))
  );
}

function statusOf(g: GalleryDoc): GalleryStatus {
  if (g.clearedAt) return "cleared";
  if (g.deliveredAt) return "delivered";
  if (g.submittedAt) return "submitted";
  return g.proofLink ? "selecting" : "new";
}

function oid(id: string) {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

// ------------------------------------------------------------- admin side ----

export async function listGalleries({ q, page }: { q?: string; page: PageParams }) {
  const collection = await galleries();
  const filter = searchFilter(q, ["clientName", "title", "clientPhone", "clientEmail", "bookingReference"]);
  const [docs, total] = await Promise.all([
    collection.find(filter).sort({ createdAt: -1 }).skip(page.skip).limit(page.pageSize).toArray(),
    collection.countDocuments(filter),
  ]);
  const list = docs.map((g) => ({
    id: g._id.toString(),
    clientName: g.clientName,
    title: g.title,
    status: statusOf(g),
    proofs: g.proofs.length,
    selected: g.selected.length,
    finals: g.finals.length,
    createdAt: g.createdAt,
  }));
  return { galleries: list, total, pageSize: page.pageSize };
}

export async function createGallery(input: ClientGalleryInput) {
  const now = new Date();
  const res = await (await galleries()).insertOne({
    ...input,
    proofs: [],
    selected: [],
    finals: [],
    createdAt: now,
    updatedAt: now,
  });
  return res.insertedId.toString();
}

// The address the client opens: /proofs/… to choose, /photos/… for the edits.
export const shareUrl = (baseUrl: string, kind: "proof" | "final", token: string) =>
  `${baseUrl}/${kind === "proof" ? "proofs" : "photos"}/${token}`;

const linkInfo = (baseUrl: string, kind: "proof" | "final", link?: ShareLink) =>
  link && { url: shareUrl(baseUrl, kind, link.token), expiresAt: link.expiresAt };

// Everything the admin page shows. Admins see the photos without a watermark.
export async function getGalleryForAdmin(id: string, baseUrl: string) {
  const _id = oid(id);
  const g = _id && (await (await galleries()).findOne({ _id }));
  if (!g) return null;
  await fillShootingTimes(g);
  const thumb = (p: ClientPhoto) => ({
    id: p.id,
    name: p.name,
    width: p.width,
    height: p.height,
    src: privateImageUrl(p.publicId, { width: 600 }),
    full: privateImageUrl(p.publicId, { width: 1600 }), // for the preview
  });
  return {
    id: g._id.toString(),
    clientName: g.clientName,
    clientPhone: g.clientPhone,
    clientEmail: g.clientEmail,
    title: g.title,
    maxSelections: g.maxSelections,
    bookingReference: g.bookingReference,
    status: statusOf(g),
    proofs: inShootingOrder(g.proofs).map(thumb),
    selected: g.selected,
    submittedAt: g.submittedAt,
    proofLink: linkInfo(baseUrl, "proof", g.proofLink),
    finals: inShootingOrder(g.finals).map(thumb),
    finalLink: linkInfo(baseUrl, "final", g.finalLink),
    deliveredAt: g.deliveredAt,
    featured: g.featured ?? [],
    clearedAt: g.clearedAt,
    clearedPicks: g.clearedPicks ?? [],
  };
}

export async function updateGallery(id: string, input: Partial<ClientGalleryInput>) {
  const _id = oid(id);
  if (!_id) return false;
  const res = await (await galleries()).updateOne({ _id }, { $set: { ...input, updatedAt: new Date() } });
  return res.matchedCount === 1;
}

export async function deleteGallery(id: string) {
  const _id = oid(id);
  if (!_id) return false;
  const res = await (await galleries()).deleteOne({ _id });
  if (res.deletedCount !== 1) return false;
  await Promise.all([deletePrivateFolder(folderFor(id, "proofs")), deletePrivateFolder(folderFor(id, "finals"))]);
  await deletePrivateFolder(`${clientsFolder}/${id}`);
  return true;
}

export function uploadFolderFor(id: string, kind: PhotoKind) {
  return oid(id) ? folderFor(id, kind) : null;
}

// Records a photo the admin's browser uploaded straight to Cloudinary, after
// checking it's really there and in this gallery's folder.
// `fileTime` is the shooting time the browser read from a big proof before scaling
// it down (which drops the camera data), used when Cloudinary finds none.
export async function addPhoto(id: string, kind: PhotoKind, publicId: string, name: string, fileTime?: Date) {
  const _id = oid(id);
  if (!_id) return null;
  const image = await getPrivateImage(publicId, folderFor(id, kind));
  if (!image) return null;
  const photo: ClientPhoto = {
    id: crypto.randomBytes(6).toString("hex"),
    publicId,
    name,
    ...image,
    takenAt: image.takenAt ?? fileTime ?? null,
  };
  const res = await (await galleries()).updateOne(
    { _id },
    { $push: { [kind]: photo }, $set: { updatedAt: new Date() } }
  );
  return res.matchedCount === 1 ? photo : null;
}

export async function removePhoto(id: string, kind: PhotoKind, photoId: string) {
  const _id = oid(id);
  if (!_id) return false;
  const g = await (await galleries()).findOneAndUpdate(
    { _id },
    {
      // A featured edit's public copy stays on the site; it can be taken down from Favourites.
      $pull: { [kind]: { id: photoId }, ...(kind === "proofs" ? { selected: photoId } : { featured: photoId }) },
      $set: { updatedAt: new Date() },
    }
  );
  const photo = g?.[kind].find((p) => p.id === photoId);
  if (!photo) return false;
  await deletePrivateImage(photo.publicId);
  return true;
}

// Several photos at once; returns how many were removed, or null if there's no such gallery.
export async function removePhotos(id: string, kind: PhotoKind, photoIds: string[]) {
  const _id = oid(id);
  if (!_id) return null;
  const g = await (await galleries()).findOneAndUpdate(
    { _id },
    {
      $pull: {
        [kind]: { id: { $in: photoIds } },
        ...(kind === "proofs" ? { selected: { $in: photoIds } } : { featured: { $in: photoIds } }),
      },
      $set: { updatedAt: new Date() },
    }
  );
  if (!g) return null;
  const wanted = new Set(photoIds);
  const removed = g[kind].filter((p) => wanted.has(p.id)).map((p) => p.publicId);
  await deleteImages(removed, { authenticated: true });
  return removed.length;
}

// Creates the link (or keeps the existing one) and sets how long it stays open.
export async function shareLink(id: string, kind: "proof" | "final", days: number) {
  const _id = oid(id);
  if (!_id) return null;
  const collection = await galleries();
  const g = await collection.findOne({ _id });
  if (!g) return null;
  const field = kind === "proof" ? "proofLink" : "finalLink";
  const link: ShareLink = {
    token: g[field]?.token ?? newToken(),
    expiresAt: new Date(Date.now() + days * 86_400_000),
  };
  await collection.updateOne(
    { _id },
    {
      $set: { [field]: link, updatedAt: new Date(), ...(kind === "final" && { deliveredAt: g.deliveredAt ?? new Date() }) },
      // Sharing again (after new uploads) makes a cleared gallery live again, and a
      // new or extended delivery deadline gets its own reminder.
      $unset: { clearedAt: "", ...(kind === "final" && { reminderSentAt: "" }) },
    }
  );
  return { ...g, [field]: link } as GalleryDoc & { _id: ObjectId };
}

export async function reopenSelection(id: string) {
  const _id = oid(id);
  if (!_id) return false;
  const res = await (await galleries()).updateOne({ _id }, { $unset: { submittedAt: "" }, $set: { updatedAt: new Date() } });
  return res.matchedCount === 1;
}

// ------------------------------------------------------------ client side ----

export type ProofView = Awaited<ReturnType<typeof getProofGallery>>;

// The client's selection page. Proofs are only ever handed out watermarked.
export async function getProofGallery(token: string) {
  const g = await (await galleries()).findOne({ "proofLink.token": token });
  if (!g) return null;
  if (!isLive(g.proofLink)) return { expired: true as const, clientName: g.clientName };
  await fillShootingTimes(g);
  return {
    expired: false as const,
    clientName: g.clientName,
    title: g.title,
    maxSelections: g.maxSelections,
    expiresAt: g.proofLink!.expiresAt,
    submitted: !!g.submittedAt,
    selected: g.selected,
    photos: inShootingOrder(g.proofs).map((p) => ({
      id: p.id,
      width: p.width,
      height: p.height,
      thumb: privateImageUrl(p.publicId, { width: 800, watermark: true }),
      full: privateImageUrl(p.publicId, { width: 1600, watermark: true }),
    })),
  };
}

export type SelectResult = { ok: true; selected: string[] } | { ok: false; error: string };

export async function setProofSelected(token: string, photoId: string, selected: boolean): Promise<SelectResult> {
  const collection = await galleries();
  const g = await collection.findOne({ "proofLink.token": token });
  if (!g || !isLive(g.proofLink)) return { ok: false, error: "This link has expired" };
  if (g.submittedAt) return { ok: false, error: "Your selection has already been sent" };
  if (!g.proofs.some((p) => p.id === photoId)) return { ok: false, error: "Photo not found" };

  // The limit is checked in the update itself, so quick taps can't overshoot it.
  const updated = await collection.findOneAndUpdate(
    {
      _id: g._id,
      submittedAt: { $exists: false },
      ...(selected && g.maxSelections && { $expr: { $lt: [{ $size: "$selected" }, g.maxSelections] } }),
    },
    selected ? { $addToSet: { selected: photoId } } : { $pull: { selected: photoId } },
    { returnDocument: "after" }
  );
  if (!updated) {
    return { ok: false, error: `You can choose up to ${g.maxSelections} photos. Unselect one to swap it` };
  }
  return { ok: true, selected: updated.selected };
}

export async function submitSelection(token: string) {
  const collection = await galleries();
  const g = await collection.findOneAndUpdate(
    {
      "proofLink.token": token,
      "proofLink.expiresAt": { $gt: new Date() },
      submittedAt: { $exists: false },
      "selected.0": { $exists: true },
      // Not over the limit (the admin may have lowered it after they picked).
      $expr: { $or: [{ $not: ["$maxSelections"] }, { $lte: [{ $size: "$selected" }, "$maxSelections"] }] },
    },
    { $set: { submittedAt: new Date(), updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  return g ? { id: g._id.toString(), clientName: g.clientName, title: g.title, count: g.selected.length } : null;
}

// The delivery page: the edited photos, clean, each downloadable in full.
export async function getFinalGallery(token: string) {
  const g = await (await galleries()).findOne({ "finalLink.token": token });
  if (!g) return null;
  if (!isLive(g.finalLink)) return { expired: true as const, clientName: g.clientName };
  await fillShootingTimes(g);
  return {
    expired: false as const,
    clientName: g.clientName,
    title: g.title,
    expiresAt: g.finalLink!.expiresAt,
    featured: g.featured ?? [],
    maxFeatured: MAX_FEATURED,
    photos: inShootingOrder(g.finals).map((p) => ({
      id: p.id,
      width: p.width,
      height: p.height,
      thumb: privateImageUrl(p.publicId, { width: 800 }),
      full: privateImageUrl(p.publicId, { width: 2000 }),
      download: privateDownloadUrl(p.publicId, p.name),
    })),
  };
}

export async function finalPublicIds(token: string) {
  const g = await (await galleries()).findOne({ "finalLink.token": token });
  if (!g || !isLive(g.finalLink)) return null;
  return { title: `B.Marvld ${g.title}`, publicIds: g.finals.map((p) => p.publicId) };
}

// ------------------------------------------------- featuring on the site ----

export const MAX_FEATURED = 2;

type FeatureResult = { ok: true; featured: string[] } | { ok: false; error: string };

/**
 * The client stars (or un-stars) one of their edits from the delivery page. A
 * starred photo goes live in "Client favourites" on the home page straight away.
 */
export async function setFinalFeatured(token: string, photoId: string, feature: boolean): Promise<FeatureResult> {
  const collection = await galleries();
  const g = await collection.findOne({ "finalLink.token": token });
  if (!g || !isLive(g.finalLink)) return { ok: false, error: "This link has closed" };
  const photo = g.finals.find((p) => p.id === photoId);
  if (!photo) return { ok: false, error: "Photo not found" };

  if (!feature) {
    const updated = await collection.findOneAndUpdate(
      { _id: g._id },
      { $pull: { featured: photoId } },
      { returnDocument: "after" }
    );
    await removeFeaturedCopy(g._id, photoId);
    return { ok: true, featured: updated?.featured ?? [] };
  }

  if (g.featured?.includes(photoId)) return { ok: true, featured: g.featured };
  // Claimed in the update itself, so quick taps can't go over the limit or copy a photo twice.
  const claimed = await collection.findOneAndUpdate(
    {
      _id: g._id,
      featured: { $ne: photoId },
      $expr: { $lt: [{ $size: { $ifNull: ["$featured", []] } }, MAX_FEATURED] },
    },
    { $addToSet: { featured: photoId } },
    { returnDocument: "after" }
  );
  if (!claimed) {
    return { ok: false, error: `You can feature ${MAX_FEATURED} photos. Tap a starred one to swap it` };
  }
  try {
    const copy = await publishPrivateImage(photo.publicId);
    await addFeatured({ ...copy, galleryId: g._id, finalId: photoId, clientName: g.clientName, title: g.title });
  } catch (err) {
    console.error("Could not feature photo:", err);
    await collection.updateOne({ _id: g._id }, { $pull: { featured: photoId } });
    return { ok: false, error: "Couldn't add that photo. Please try again" };
  }
  return { ok: true, featured: claimed.featured ?? [] };
}

/** The admin took a favourite down: the client sees it un-starred. */
export async function unmarkFeatured(galleryId: ObjectId, finalId: string) {
  await (await galleries()).updateOne({ _id: galleryId }, { $pull: { featured: finalId } });
}

// ------------------------------------------------------------- clean-up ----
// Run every hour by Upstash QStash (POST /api/cron/cleanup). Once a delivery
// link closes, the gallery's proofs and edits are deleted from Cloudinary; a
// day before, the client gets a reminder to download them. Photos the client
// featured on the site are separate copies and stay. Galleries that were never
// delivered are left alone.

const BATCH = 20; // per run, to stay well inside a serverless time limit; the next run picks up the rest

/** Galleries whose delivery link closes within the next day and haven't had a reminder. */
export async function galleriesToRemind(now = new Date()) {
  const docs = await (await galleries())
    .find({
      "finalLink.expiresAt": { $gt: now, $lte: new Date(now.getTime() + 86_400_000) },
      reminderSentAt: { $exists: false },
      clearedAt: { $exists: false },
      "finals.0": { $exists: true },
    })
    .limit(BATCH)
    .toArray();
  return docs.map((g) => ({ id: g._id, contact: g as GalleryContact, token: g.finalLink!.token, expiresAt: g.finalLink!.expiresAt }));
}

export async function markReminded(id: ObjectId) {
  await (await galleries()).updateOne({ _id: id }, { $set: { reminderSentAt: new Date() } });
}

/** Deletes the photos of every gallery whose delivery link has closed. Returns how many were cleared. */
export async function clearExpiredGalleries(now = new Date()) {
  const collection = await galleries();
  const due = await collection
    .find({ "finalLink.expiresAt": { $lte: now }, clearedAt: { $exists: false } })
    .limit(BATCH)
    .toArray();
  for (const g of due) {
    const id = g._id.toString();
    await Promise.all([deletePrivateFolder(folderFor(id, "proofs")), deletePrivateFolder(folderFor(id, "finals"))]);
    await deletePrivateFolder(`${clientsFolder}/${id}`);
    const selected = new Set(g.selected);
    await collection.updateOne(
      { _id: g._id },
      {
        $set: {
          clearedAt: new Date(),
          clearedPicks: inShootingOrder(g.proofs).filter((p) => selected.has(p.id)).map((p) => p.name),
          proofs: [],
          finals: [],
          selected: [],
          updatedAt: new Date(),
        },
      }
    );
  }
  return due.length;
}

/** The proofs the client picked, for the admin to download without the watermark. */
export async function pickedPublicIds(id: string) {
  const _id = oid(id);
  if (!_id) return null;
  const g = await (await galleries()).findOne({ _id });
  if (!g) return null;
  const selected = new Set(g.selected);
  return {
    title: `${g.clientName} picks`,
    publicIds: g.proofs.filter((p) => selected.has(p.id)).map((p) => p.publicId),
  };
}

export type GalleryContact = Pick<GalleryDoc, "clientName" | "clientPhone" | "clientEmail" | "title">;
