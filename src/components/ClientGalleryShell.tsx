import Link from "next/link";
import Logo from "./Logo";

// The frame around a client's private gallery pages (/proofs/…, /photos/…).
export default function ClientGalleryShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-svh px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="mb-10 block text-center text-2xl">
          <Logo />
        </Link>
        {children}
      </div>
    </main>
  );
}

export function GalleryHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8 text-center">
      <p className="text-xs tracking-[0.4em] text-gold uppercase">{eyebrow}</p>
      <h1 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">{title}</h1>
      {children && <p className="mx-auto mt-4 max-w-xl text-cream-dim">{children}</p>}
    </div>
  );
}

export function LinkClosed({ clientName }: { clientName?: string }) {
  return (
    <div className="viewfinder mx-auto max-w-lg p-10 text-center text-cream/40">
      <div className="text-cream">
        <h1 className="font-display text-3xl font-semibold">This link has closed</h1>
        <p className="mt-4 text-cream-dim">
          {clientName ? `Sorry ${clientName.split(" ")[0]}, this` : "This"} gallery link is no longer open. Reach out to
          B.Marvld and we&apos;ll send you a fresh one.
        </p>
      </div>
    </div>
  );
}
