"use client";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function PickPackageButton({ packageId }: { packageId: string }) {
  return (
    <a
      href="#book"
      onClick={() => window.dispatchEvent(new CustomEvent("pick-package", { detail: packageId }))}
      className={cn(buttonVariants({ variant: "outline" }), "mt-8 w-full")}
    >
      Book this
    </a>
  );
}
