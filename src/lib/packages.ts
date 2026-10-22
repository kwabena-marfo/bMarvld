import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";
import { defaultPackages, type Package } from "@/data/packages";
import type { PackageInput } from "./schemas";

type PackageDoc = Omit<Package, "id"> & { order: number; createdAt: Date; updatedAt: Date };

let seeded = false;

async function packagesCollection() {
  const db = await getDb();
  const collection = db.collection<PackageDoc>("packages");
  if (!seeded) {
    if ((await collection.estimatedDocumentCount()) === 0) {
      const now = new Date();
      await collection.insertMany(
        defaultPackages.map((p, order) => ({ ...p, order, createdAt: now, updatedAt: now }))
      );
    }
    seeded = true;
  }
  return collection;
}

const toPackage = ({ _id, name, price, depositPercent, duration, features, active }: PackageDoc & { _id: ObjectId }): Package => ({
  id: _id.toString(),
  name,
  price,
  depositPercent,
  duration,
  features,
  active,
});

// Everything, for the admin page; the site only shows active packages.
export async function listPackages({ activeOnly }: { activeOnly: boolean }) {
  const collection = await packagesCollection();
  const docs = await collection
    .find(activeOnly ? { active: true } : {})
    .sort({ order: 1, createdAt: 1 })
    .toArray();
  return docs.map(toPackage);
}

export async function findActivePackage(id: string) {
  if (!ObjectId.isValid(id)) return null;
  const collection = await packagesCollection();
  const doc = await collection.findOne({ _id: new ObjectId(id), active: true });
  return doc ? toPackage(doc) : null;
}

export async function createPackage(input: PackageInput) {
  const collection = await packagesCollection();
  const last = await collection.find().sort({ order: -1 }).limit(1).next();
  const now = new Date();
  const doc = { ...input, order: (last?.order ?? -1) + 1, createdAt: now, updatedAt: now };
  const res = await collection.insertOne(doc);
  return toPackage({ ...doc, _id: res.insertedId });
}

export async function updatePackage(id: string, input: Partial<PackageInput>) {
  if (!ObjectId.isValid(id)) return null;
  const collection = await packagesCollection();
  const doc = await collection.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { ...input, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  return doc ? toPackage(doc) : null;
}

// Bookings keep their own copy of the package name and price, so deleting a
// package never changes existing bookings.
export async function deletePackage(id: string) {
  if (!ObjectId.isValid(id)) return false;
  const collection = await packagesCollection();
  const res = await collection.deleteOne({ _id: new ObjectId(id) });
  return res.deletedCount === 1;
}

export async function reorderPackages(ids: string[]) {
  const collection = await packagesCollection();
  await collection.bulkWrite(
    ids.filter(ObjectId.isValid).map((id, order) => ({
      updateOne: { filter: { _id: new ObjectId(id) }, update: { $set: { order } } },
    }))
  );
}
