import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";
import type { Shot } from "@/data/gallery";

type PhotoDoc = {
  publicId: string;
  url: string;
  width: number;
  height: number;
  alt: string;
  category: Shot["category"];
  createdAt: Date;
};

async function photosCollection() {
  const db = await getDb();
  return db.collection<PhotoDoc>("photos");
}

export async function listPhotos(): Promise<Shot[]> {
  const photos = await photosCollection();
  const docs = await photos.find().sort({ createdAt: -1 }).toArray();
  return docs.map((d) => ({
    id: d._id.toString(),
    src: d.url,
    alt: d.alt,
    category: d.category,
    width: d.width,
    height: d.height,
  }));
}

export async function addPhoto(doc: Omit<PhotoDoc, "createdAt">) {
  const photos = await photosCollection();
  const res = await photos.insertOne({ ...doc, createdAt: new Date() });
  return res.insertedId.toString();
}

// Removes the record and returns its Cloudinary id so the file can be deleted too.
export async function removePhoto(id: string) {
  if (!ObjectId.isValid(id)) return null;
  const photos = await photosCollection();
  const doc = await photos.findOneAndDelete({ _id: new ObjectId(id) });
  return doc?.publicId ?? null;
}

// Several at once; returns the Cloudinary ids of the ones that existed.
export async function removePhotos(ids: string[]) {
  const _ids = ids.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
  if (!_ids.length) return [];
  const photos = await photosCollection();
  const docs = await photos.find({ _id: { $in: _ids } }, { projection: { publicId: 1 } }).toArray();
  await photos.deleteMany({ _id: { $in: docs.map((d) => d._id) } });
  return docs.map((d) => d.publicId);
}
