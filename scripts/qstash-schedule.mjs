// Creates (or updates) the Upstash QStash schedule that runs the client-gallery
// clean-up every hour: reminders a day before a delivery link closes, then the
// photos are deleted from Cloudinary once it has. Run once, after deploying:
//
//   npm run qstash:schedule                      → https://bmarvld.com
//   npm run qstash:schedule -- https://other.url  → somewhere else
//
// Re-running replaces the same schedule (fixed id), so it never doubles up.
import { Client } from "@upstash/qstash";

const site = (process.argv[2] ?? "https://bmarvld.com").replace(/\/$/, "");
const destination = `${site}/api/cron/cleanup`;

if (!process.env.QSTASH_TOKEN) {
  console.error("QSTASH_TOKEN isn't set in .env.local");
  process.exit(1);
}

const client = new Client({ token: process.env.QSTASH_TOKEN });
const { scheduleId } = await client.schedules.create({
  scheduleId: "bmarvld-gallery-cleanup",
  destination,
  method: "POST",
  cron: "0 * * * *", // on the hour, every hour
  retries: 3,
});

console.log(`Schedule ${scheduleId}: POST ${destination} every hour`);
