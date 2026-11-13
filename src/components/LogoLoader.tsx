import { cn } from "@/lib/utils";

// The logo's viewfinder corners pulling in and out like a lens finding focus,
// with its gold dot blinking like a camera's record light. Styles live in
// globals.css (.logo-loader). Sized by its width; the corners take currentColor.
export default function LogoLoader({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <span role="status" aria-label={label} className={cn("logo-loader size-12 text-cream/70", className)}>
      <i />
      <i />
      <i />
      <i />
      <b />
    </span>
  );
}
