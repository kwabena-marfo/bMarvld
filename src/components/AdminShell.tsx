"use client";

import { MenuIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { adminFetch } from "@/lib/admin-api";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/admin", label: "Bookings" },
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/packages", label: "Packages" },
  { href: "/admin/gallery", label: "Gallery" },
  { href: "/admin/favourites", label: "Favourites" },
  { href: "/admin/dates", label: "Dates" },
];

// Every admin API call is already session-checked on the server; this guard
// just avoids flashing the dashboard to a signed-out visitor.
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Escape closes the phone menu.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  useEffect(() => {
    adminFetch<{ email: string }>("/me")
      .then((d) => setEmail(d.email))
      .catch(() => {});
  }, []);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
  }

  if (!email) {
    return <main className="flex min-h-svh items-center justify-center text-sm text-cream-dim">Loading…</main>;
  }

  const isActive = (href: string) => pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`));

  return (
    <div className="min-h-svh">
      <header className="relative z-40 border-b border-cream/10 bg-ink">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/admin" className="text-lg">
            <Logo />
          </Link>

          {/* Wide screens: the links in a row. */}
          <nav className="hidden items-center gap-6 text-xs tracking-[0.2em] uppercase md:flex">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={isActive(n.href) ? "text-gold" : "text-cream-dim hover:text-cream"}
              >
                {n.label}
              </Link>
            ))}
            <Button variant="link" size="sm" onClick={logout} title={`Signed in as ${email}`} className="px-0 text-xs tracking-[0.2em] text-cream-dim uppercase">
              Log out
            </Button>
          </nav>

          {/* Phones: a menu button that drops the links down. */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="admin-menu"
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <XIcon className="size-6" /> : <MenuIcon className="size-6" />}
          </Button>
        </div>

        {menuOpen && (
          <>
            {/* Dims the page behind the open menu (under the header bar); a tap closes it. */}
            <div className="fixed inset-0 -z-10 bg-ink/60 md:hidden" onClick={() => setMenuOpen(false)} aria-hidden />
            <nav
              id="admin-menu"
              className="absolute inset-x-0 top-full border-b border-cream/10 bg-ink px-4 pb-4 text-sm tracking-[0.2em] uppercase md:hidden"
            >
              {nav.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "block border-b border-cream/5 py-3.5",
                    isActive(n.href) ? "text-gold" : "text-cream-dim hover:text-cream"
                  )}
                >
                  {n.label}
                </Link>
              ))}
              <div className="flex items-center justify-between gap-3 pt-4">
                <span className="truncate text-xs tracking-normal normal-case text-cream-dim">{email}</span>
                <Button variant="outline" size="sm" onClick={logout} className="text-xs tracking-[0.2em] uppercase">
                  Log out
                </Button>
              </div>
            </nav>
          </>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">{children}</main>
      <Toaster position="top-center" />
    </div>
  );
}
