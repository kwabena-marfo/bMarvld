"use client";

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
  { href: "/admin/packages", label: "Packages" },
  { href: "/admin/gallery", label: "Gallery" },
  { href: "/admin/dates", label: "Dates" },
];

// Every admin API call is already session-checked on the server; this guard
// just avoids flashing the dashboard to a signed-out visitor.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

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

  return (
    <div className="min-h-svh">
      <header className="border-b border-cream/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-4 sm:px-6">
          <Link href="/admin" className="text-lg">
            <Logo />
          </Link>
          <nav className="flex flex-wrap items-center gap-4 text-xs tracking-[0.2em] uppercase sm:gap-6">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={cn(pathname === n.href ? "text-gold" : "text-cream-dim hover:text-cream")}
              >
                {n.label}
              </Link>
            ))}
            <Button variant="link" size="sm" onClick={logout} title={`Signed in as ${email}`} className="px-0 text-xs tracking-[0.2em] text-cream-dim uppercase">
              Log out
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">{children}</main>
      <Toaster position="top-center" />
    </div>
  );
}
