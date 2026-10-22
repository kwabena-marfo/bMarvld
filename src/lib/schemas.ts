import { z } from "zod";
import { photoCategories } from "@/data/gallery";

// Shared by the forms (react-hook-form + zodResolver) and the API, so the
// browser and server always validate the same way.

export const bookingSchema = z.object({
  name: z.string("Please enter your full name").trim().min(2, "Please enter your full name"),
  email: z.email("Enter a valid email").trim().toLowerCase(),
  phone: z.string("Enter a valid phone number").trim().regex(/^\+?[0-9\s-]{9,15}$/, "Enter a valid phone number"),
  packageId: z.string("Choose a package").min(1, "Choose a package"),
  date: z
    .string("Choose a date")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date")
    .refine((d) => d > new Date().toISOString().slice(0, 10), "Pick a date from tomorrow onwards"),
  time: z.string("Choose a start time").regex(/^\d{2}:\d{2}$/, "Choose a start time"),
  location: z.string("Where is the shoot?").trim().min(2, "Where is the shoot?"),
  notes: z.string().trim().max(1000, "Keep it under 1000 characters").optional().default(""),
});

export type BookingInput = z.output<typeof bookingSchema>;

export const packageSchema = z.object({
  name: z.string().trim().min(2, "Give the package a name").max(60),
  price: z.number("Enter a price").positive("Price must be more than 0").max(1_000_000),
  depositPercent: z
    .number("Enter a deposit %")
    .int("Use a whole number")
    .min(1, "At least 1%")
    .max(100, "At most 100%"),
  duration: z.string().trim().min(1, "e.g. 1 hour, Full day").max(40),
  features: z.array(z.string().trim().min(1).max(80)).max(12, "Up to 12 items"),
  active: z.boolean(),
});

export type PackageInput = z.output<typeof packageSchema>;

export const emailSchema = z.object({
  email: z.email("Enter a valid email").trim().toLowerCase(),
});

export const loginCodeSchema = emailSchema.extend({
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from your email"),
});

export const blockDateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
});

export const photoDetailsSchema = z.object({
  category: z.enum(photoCategories, "Choose a category"),
  alt: z.string().trim().max(200).default(""),
});
