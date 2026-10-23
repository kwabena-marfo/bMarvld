import Image from "next/image";
import { cn } from "@/lib/utils";

// The B.Marvld logo artwork, cut out from public/brand/logo-dark.png: cream
// letters for the dark theme, ink letters for the light one, gold dots in both.
// Sized in em, so the surrounding text size (text-xl, text-5xl…) sets its height.
const art = {
  wordmark: { file: "wordmark", width: 880, height: 150, className: "h-[1em]" },
  tagline: { file: "wordmark-tagline", width: 880, height: 223, className: "h-[1.49em]" },
  mark: { file: "mark", width: 1053, height: 382, className: "h-[2.2em]" },
};

export default function Logo({
  tagline = false,
  mark = false,
  className = "",
}: {
  tagline?: boolean; // add "...be marveled" under the wordmark
  mark?: boolean; // the full logo: wordmark, tagline and viewfinder corners
  className?: string;
}) {
  const a = art[mark ? "mark" : tagline ? "tagline" : "wordmark"];
  const img = cn("w-auto max-w-none", a.className);

  return (
    <span className={cn("inline-flex leading-none", className)}>
      <Image src={`/brand/${a.file}-cream.png`} alt="B.Marvld" width={a.width} height={a.height} className={cn(img, "hidden dark:block")} />
      <Image src={`/brand/${a.file}-ink.png`} alt="B.Marvld" width={a.width} height={a.height} className={cn(img, "dark:hidden")} />
    </span>
  );
}
