import { Suspense } from "react";
import AdminShell from "@/components/AdminShell";

// The shell reads the URL (for the active nav link), which can't be known
// while prerendering a page like /admin/clients/[id], so it streams in.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<main className="flex min-h-svh items-center justify-center text-sm text-cream-dim">Loading…</main>}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
