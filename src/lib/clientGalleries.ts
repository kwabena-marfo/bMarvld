import crypto from "crypto";
import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";
import { searchFilter, type PageParams } from "./listQuery";
import {
  clientsFolder,
  deletePrivateFolder,
  deletePrivateImage,
  getPrivateImage,
  privateDownloadUrl,
  privateImageUrl,
} from "./cloudinary";
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

function statusOf(g: GalleryDoc): GalleryStatus {
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
  const thumb = (p: ClientPhoto) => ({
    id: p.id,
    name: p.name,
    width: p.width,
    height: p.height,
    src: privateImageUrl(p.publicId, { width: 600 }),
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
    proofs: g.proofs.map(thumb),
    selected: g.selected,
    submittedAt: g.submittedAt,
    proofLink: linkInfo(baseUrl, "proof", g.proofLink),
    finals: g.finals.map(thumb),
    finalLink: linkInfo(baseUrl, "final", g.finalLink),
    deliveredAt: g.deliveredAt,
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
export async function addPhoto(id: string, kind: PhotoKind, publicId: string, name: string) {
  const _id = oid(id);
  if (!_id) return null;
  const image = await getPrivateImage(publicId, folderFor(id, kind));
  if (!image) return null;
  const photo: ClientPhoto = { id: crypto.randomBytes(6).toString("hex"), publicId, name, ...image };
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
      $pull: { [kind]: { id: photoId }, ...(kind === "proofs" && { selected: photoId }) },
      $set: { updatedAt: new Date() },
    }
  );
  const photo = g?.[kind].find((p) => p.id === photoId);
  if (!photo) return false;
  await deletePrivateImage(photo.publicId);
  return true;
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
    { $set: { [field]: link, updatedAt: new Date(), ...(kind === "final" && { deliveredAt: g.deliveredAt ?? new Date() }) } }
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
  return {
    expired: false as const,
    clientName: g.clientName,
    title: g.title,
    maxSelections: g.maxSelections,
    expiresAt: g.proofLink!.expiresAt,
    submitted: !!g.submittedAt,
    selected: g.selected,
    photos: [...g.proofs].sort(byName).map((p) => ({
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
    return { ok: false, error: `You can choose up to ${g.maxSelections} photos — unselect one to swap it` };
  }
  return { ok: true, selected: updated.selected };
}

export async function submitSelection(token: string) {
  const collection = await galleries();
  const g = await collection.findOneAndUpdate(
    { "proofLink.token": token, "proofLink.expiresAt": { $gt: new Date() }, submittedAt: { $exists: false }, "selected.0": { $exists: true } },
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
  return {
    expired: false as const,
    clientName: g.clientName,
    title: g.title,
    expiresAt: g.finalLink!.expiresAt,
    photos: [...g.finals].sort(byName).map((p) => ({
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
  return { title: `B.Marvld - ${g.title}`, publicIds: g.finals.map((p) => p.publicId) };
}

/** The proofs the client picked, for the admin to download without the watermark. */
export async function pickedPublicIds(id: string) {
  const _id = oid(id);
  if (!_id) return null;
  const g = await (await galleries()).findOne({ _id });
  if (!g) return null;
  const selected = new Set(g.selected);
  return {
    title: `${g.clientName} - picks`,
    publicIds: g.proofs.filter((p) => selected.has(p.id)).map((p) => p.publicId),
  };
}

export type GalleryContact = Pick<GalleryDoc, "clientName" | "clientPhone" | "clientEmail" | "title">;
