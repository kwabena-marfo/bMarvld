"use client";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Picks the package in the booking form and takes the visitor straight to the
// first box they fill in, ready to type.
export default function PickPackageButton({ packageId }: { packageId: string }) {
  return (
    <a
      href="#book-name"
      onClick={() => {
        window.dispatchEvent(new CustomEvent("pick-package", { detail: packageId }));
        // The link does the (smooth) scrolling; focus without a second jump.
        document.getElementById("book-name")?.focus({ preventScroll: true });
      }}
      className={cn(buttonVariants({ variant: "outline" }), "mt-8 w-full")}
    >
      Book this
    </a>
  );
}
