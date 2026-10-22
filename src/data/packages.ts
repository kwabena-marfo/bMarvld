// Packages live in MongoDB and are managed from /admin/packages. These are
// only the starting set, inserted the first time the collection is empty.
export type Package = {
  id: string;
  name: string;
  price: number; // GHS
  depositPercent: number; // 1–100: share of the price paid upfront to book
  duration: string;
  features: string[];
  active: boolean; // shown on the site and bookable
};

export const defaultPackages: Omit<Package, "id">[] = [
  {
    name: "Portrait",
    price: 800,
    depositPercent: 50,
    duration: "1 hour",
    features: ["1 location", "2 outfit changes", "15 edited photos", "Online gallery"],
    active: true,
  },
  {
    name: "Lifestyle & Couples",
    price: 1500,
    depositPercent: 50,
    duration: "2 hours",
    features: ["Up to 2 locations", "Unlimited outfits", "35 edited photos", "Online gallery"],
    active: true,
  },
  {
    name: "Events",
    price: 3000,
    depositPercent: 50,
    duration: "Up to 5 hours",
    features: ["Birthdays, launches, parties", "150+ edited photos", "Sneak peeks in 48h", "Online gallery"],
    active: true,
  },
  {
    name: "Weddings",
    price: 7500,
    depositPercent: 50,
    duration: "Full day",
    features: ["Pre-wedding shoot", "Ceremony & reception", "400+ edited photos", "Printed photobook"],
    active: true,
  },
];

export function depositFor(pkg: Pick<Package, "price" | "depositPercent">) {
  return Math.round(pkg.price * pkg.depositPercent) / 100;
}

export function formatCedis(amount: number) {
  return `GH₵ ${amount.toLocaleString("en-GH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
