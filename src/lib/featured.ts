import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";
import { deleteImage, publicImageUrl } from "./cloudinary";
import { searchFilter, type PageParams } from "./listQuery";

// Edited photos clients chose to have featured on the site ("Client favourites"
// on the home page). Each is a public copy, independent of the client's private
// gallery, so it stays up after that gallery is cleared or deleted.

type FeaturedDoc = {
  publicId: string;
  width: number;
  height: number;
  galleryId: ObjectId;
  finalId: string; // the edit it was copied from
  clientName: string;
  title: string;
  createdAt: Date;
};

let indexesEnsured = false;

async function featured() {
  const db = await getDb();
  const collection = db.collection<FeaturedDoc>("featuredPhotos");
  if (!indexesEnsured) {
    await collection.createIndex({ galleryId: 1, finalId: 1 }, { unique: true });
    await collection.createIndex({ createdAt: -1 });
    indexesEnsured = true;
  }
  return collection;
}

/** For the home page, newest first. */
export async function listFeatured() {
  const docs = await (await featured()).find().sort({ createdAt: -1 }).limit(200).toArray();
  return docs.map((d) => ({
    id: d._id.toString(),
    width: d.width,
    height: d.height,
    thumb: publicImageUrl(d.publicId, 900),
    full: publicImageUrl(d.publicId, 2000),
  }));
}

export async function listFeaturedForAdmin({ q, page }: { q?: string; page: PageParams }) {
  const collection = await featured();
  const filter = searchFilter(q, ["clientName", "title"]);
  const [docs, total] = await Promise.all([
    collection.find(filter).sort({ createdAt: -1 }).skip(page.skip).limit(page.pageSize).toArray(),
    collection.countDocuments(filter),
  ]);
  return {
    photos: docs.map((d) => ({
      id: d._id.toString(),
      galleryId: d.galleryId.toString(),
      clientName: d.clientName,
      title: d.title,
      createdAt: d.createdAt,
      width: d.width,
      height: d.height,
      src: publicImageUrl(d.publicId, 600),
    })),
    total,
    pageSize: page.pageSize,
  };
}

export async function addFeatured(doc: Omit<FeaturedDoc, "createdAt">) {
  await (await featured()).insertOne({ ...doc, createdAt: new Date() });
}

/** Takes a photo off the site and deletes its public copy. Returns where it came from. */
async function removeWhere(filter: Partial<Pick<FeaturedDoc, "galleryId" | "finalId">> | { _id: ObjectId }) {
  const doc = await (await featured()).findOneAndDelete(filter);
  if (!doc) return null;
  await deleteImage(doc.publicId).catch((err) => console.error("Could not delete featured image:", err));
  return { galleryId: doc.galleryId, finalId: doc.finalId };
}

export const removeFeaturedCopy = (galleryId: ObjectId, finalId: string) => removeWhere({ galleryId, finalId });

export function removeFeatured(id: string) {
  return ObjectId.isValid(id) ? removeWhere({ _id: new ObjectId(id) }) : Promise.resolve(null);
}
