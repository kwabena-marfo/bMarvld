import Link from "next/link";
import Logo from "./Logo";
import { buttonVariants } from "@/components/ui/button";

const links = [
  { href: "/#work", label: "Work" },
  { href: "/#about", label: "About" },
  { href: "/#packages", label: "Packages" },
];

export default function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-cream/10 bg-ink/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="text-xl" aria-label="B.Marvld home">
          <Logo />
        </Link>
        <nav className="flex items-center gap-6 text-xs tracking-[0.2em] uppercase">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hidden text-cream-dim transition hover:text-cream sm:inline">
              {l.label}
            </Link>
          ))}
          <Link href="/#book" className={buttonVariants({ size: "sm" })}>
            Book
          </Link>
        </nav>
      </div>
    </header>
  );
}
