import { MongoClient, type Db } from "mongodb";

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function createClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGODB_URI environment variable");
  return new MongoClient(uri).connect();
}

let cachedClientPromise: Promise<MongoClient> | undefined;

// Connects lazily, on first actual use, rather than at module import time —
// otherwise anything that merely imports this file (e.g. during a build's
// static-prerender pass) would trigger a real MongoDB connection attempt.
function getClientPromise(): Promise<MongoClient> {
  if (process.env.NODE_ENV === "development") {
    // Reuse the client across hot-reloads in dev so we don't open a new
    // connection pool on every module re-evaluation.
    return (globalThis._mongoClientPromise ??= createClientPromise());
  }
  return (cachedClientPromise ??= createClientPromise());
}

export async function getDb(): Promise<Db> {
  const dbName = process.env.MONGODB_DB;
  if (!dbName) throw new Error("Missing MONGODB_DB environment variable");
  const client = await getClientPromise();
  return client.db(dbName);
}
