// Fills a demo database for Vercel preview deployments, so previews show
// realistic packages, bookings and calendar dates without touching the real
// "bmarvld" data. Safe to re-run: it wipes and refills the demo database.
//
//   npm run seed:demo                 # seeds "bmarvld_demo"
//   npm run seed:demo -- other_demo   # seeds another database ending in "_demo"
//
// Reads MONGODB_URI from .env.local. Dates are relative to today, so re-run it
// when the demo bookings have drifted into the past.
import crypto from "crypto";
import { MongoClient } from "mongodb";
import { defaultPackages, depositFor } from "../src/data/packages.ts";

const dbName = process.argv[2] ?? "bmarvld_demo";
if (!dbName.endsWith("_demo")) {
  console.error(`Refusing to wipe "${dbName}": the demo database name must end in "_demo".`);
  process.exit(1);
}
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("Missing MONGODB_URI (run with --env-file=.env.local).");
  process.exit(1);
}

const DAY = 86_400_000;
const isoDate = (offsetDays) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * DAY);
const reference = () => `BMV-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;

const client = await new MongoClient(uri).connect();
try {
  const db = client.db(dbName);
  await Promise.all(["packages", "bookings", "dateLocks", "photos", "loginCodes"].map((c) => db.collection(c).deleteMany({})));

  // The site's starting packages, plus a retired one to show the hidden state in /admin/packages.
  const now = new Date();
  const packages = [
    ...defaultPackages,
    {
      name: "Graduation Mini",
      price: 500,
      depositPercent: 100,
      duration: "30 minutes",
      features: ["Campus or studio", "1 outfit", "8 edited photos"],
      active: false,
    },
  ].map((p, order) => ({ ...p, order, createdAt: now, updatedAt: now }));
  const { insertedIds } = await db.collection("packages").insertMany(packages);
  const pkg = (name) => {
    const i = packages.findIndex((p) => p.name === name);
    return { ...packages[i], id: insertedIds[i].toString() };
  };

  const booking = ({ client: [name, email, phone], pkgName, date, time, location, notes = "", status, created }) => {
    const p = pkg(pkgName);
    const paid = status === "deposit_paid" || status === "needs_refund";
    return {
      name,
      email,
      phone,
      packageId: p.id,
      date,
      time,
      location,
      notes,
      reference: reference(),
      packageName: p.name,
      price: p.price,
      depositPercent: p.depositPercent,
      deposit: depositFor(p),
      status,
      createdAt: daysAgo(created),
      ...(paid && {
        paidAt: new Date(daysAgo(created).getTime() + 12 * 60_000),
        payment: { channel: "mobile_money", fees: Math.round(depositFor(p) * 1.95) / 100 },
      }),
    };
  };

  const bookings = [
    booking({ client: ["Akosua Mensah", "akosua.demo@example.com", "0240000001"], pkgName: "Portrait", date: isoDate(4), time: "10:00", location: "B.Marvld Studio, East Legon", notes: "Birthday shoot — bringing two outfits.", status: "deposit_paid", created: 6 }),
    booking({ client: ["Kwame & Esi Boateng", "boateng.demo@example.com", "0200000002"], pkgName: "Weddings", date: isoDate(18), time: "08:30", location: "Holy Spirit Cathedral, Adabraka", notes: "Reception at La Palm afterwards.", status: "deposit_paid", created: 21 }),
    booking({ client: ["Nana Ama Owusu", "nanaama.demo@example.com", "0550000003"], pkgName: "Lifestyle & Couples", date: isoDate(9), time: "16:00", location: "Labadi Beach", status: "deposit_paid", created: 3 }),
    booking({ client: ["Kofi Asante", "kofi.demo@example.com", "0270000004"], pkgName: "Events", date: isoDate(25), time: "14:00", location: "Kempinski Hotel, Accra", notes: "Product launch — need brand shots of the team too.", status: "deposit_paid", created: 1 }),
    booking({ client: ["Abena Darko", "abena.demo@example.com", "0240000005"], pkgName: "Portrait", date: isoDate(9), time: "11:00", location: "B.Marvld Studio, East Legon", notes: "Paid after the date was taken.", status: "needs_refund", created: 2 }),
    booking({ client: ["Yaw Ofori", "yaw.demo@example.com", "0200000006"], pkgName: "Lifestyle & Couples", date: isoDate(12), time: "15:30", location: "Aburi Botanical Gardens", status: "failed", created: 5 }),
    booking({ client: ["Efua Quaye", "efua.demo@example.com", "0550000007"], pkgName: "Portrait", date: isoDate(15), time: "09:00", location: "B.Marvld Studio, East Legon", status: "pending", created: 2 }),
    booking({ client: ["Adjoa Frimpong", "adjoa.demo@example.com", "0270000008"], pkgName: "Portrait", date: isoDate(-10), time: "13:00", location: "B.Marvld Studio, East Legon", notes: "Maternity portraits.", status: "deposit_paid", created: 24 }),
  ];
  await db.collection("bookings").createIndex({ reference: 1 }, { unique: true });
  await db.collection("bookings").createIndex({ createdAt: -1 });
  await db.collection("bookings").insertMany(bookings);

  // Paid bookings hold their dates; a few days are closed by the admin.
  const dateLocks = [
    ...bookings.filter((b) => b.status === "deposit_paid").map((b) => ({ _id: b.date, kind: "booked", reference: b.reference })),
    ...[7, 8, 21].map((d) => ({ _id: isoDate(d), kind: "blocked", reference: "ADMIN" })),
  ];
  await db.collection("dateLocks").insertMany(dateLocks);

  console.log(`Seeded "${dbName}": ${packages.length} packages, ${bookings.length} bookings, ${dateLocks.length} date locks.`);
} finally {
  await client.close();
}
