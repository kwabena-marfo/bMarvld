// Session packages shown on the site and used by the API to price bookings.
// Prices are in Ghana cedis; the deposit is always computed server-side from
// this list, never taken from the client.
export const DEPOSIT_RATE = 0.5;

export type Package = {
  id: string;
  name: string;
  price: number; // GHS
  duration: string;
  features: string[];
};

export const packages: Package[] = [
  {
    id: "portrait",
    name: "Portrait",
    price: 800,
    duration: "1 hour",
    features: ["1 location", "2 outfit changes", "15 edited photos", "Online gallery"],
  },
  {
    id: "lifestyle",
    name: "Lifestyle & Couples",
    price: 1500,
    duration: "2 hours",
    features: ["Up to 2 locations", "Unlimited outfits", "35 edited photos", "Online gallery"],
  },
  {
    id: "event",
    name: "Events",
    price: 3000,
    duration: "Up to 5 hours",
    features: ["Birthdays, launches, parties", "150+ edited photos", "Sneak peeks in 48h", "Online gallery"],
  },
  {
    id: "wedding",
    name: "Weddings",
    price: 7500,
    duration: "Full day",
    features: ["Pre-wedding shoot", "Ceremony & reception", "400+ edited photos", "Printed photobook"],
  },
];

export function findPackage(id: string) {
  return packages.find((p) => p.id === id);
}

export function depositFor(pkg: Package) {
  return Math.round(pkg.price * DEPOSIT_RATE * 100) / 100;
}

export function formatCedis(amount: number) {
  return `GH₵ ${amount.toLocaleString("en-GH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
