"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import Logo from "./Logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/#work", label: "Work" },
  { href: "/#about", label: "About" },
  { href: "/#packages", label: "Packages" },
];

function subscribe(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}

// Clear over the hero; the blur only kicks in once the page has scrolled.
export default function SiteHeader() {
  const scrolled = useSyncExternalStore(subscribe, () => window.scrollY > 8, () => false);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-[backdrop-filter] duration-300",
        scrolled ? "backdrop-blur-md" : "backdrop-blur-none"
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="text-xl" aria-label="B.Marvld home">
          <Logo mark />
        </Link>
        <nav className="flex items-center gap-6 text-xs tracking-[0.2em] uppercase">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hidden text-cream-dim transition hover:text-cream sm:inline">
              {l.label}
            </Link>
          ))}
          <Link href="/#book" className={cn(buttonVariants(), "px-6 text-sm")}>
            Book
          </Link>
        </nav>
      </div>
    </header>
  );
}
