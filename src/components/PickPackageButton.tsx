"use client";

export default function PickPackageButton({ packageId }: { packageId: string }) {
  return (
    <a
      href="#book"
      onClick={() => window.dispatchEvent(new CustomEvent("pick-package", { detail: packageId }))}
      className="mt-8 block border border-cream/30 py-3 text-center text-xs tracking-[0.2em] uppercase transition hover:border-gold hover:text-gold"
    >
      Book this
    </a>
  );
}
