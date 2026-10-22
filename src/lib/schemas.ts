import { z } from "zod";
import { packages } from "@/data/packages";

const packageIds = packages.map((p) => p.id) as [string, ...string[]];

export const bookingSchema = z.object({
  name: z.string("Please enter your full name").trim().min(2, "Please enter your full name"),
  email: z.email("Enter a valid email").trim().toLowerCase(),
  phone: z.string("Enter a valid phone number").trim().regex(/^\+?[0-9\s-]{9,15}$/, "Enter a valid phone number"),
  packageId: z.enum(packageIds, "Choose a package"),
  date: z
    .string("Choose a date")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date")
    .refine((d) => d > new Date().toISOString().slice(0, 10), "Pick a date from tomorrow onwards"),
  time: z.string("Choose a start time").regex(/^\d{2}:\d{2}$/, "Choose a start time"),
  location: z.string("Where is the shoot?").trim().min(2, "Where is the shoot?"),
  notes: z.string().trim().max(1000).optional().default(""),
});

export type BookingInput = z.infer<typeof bookingSchema>;
