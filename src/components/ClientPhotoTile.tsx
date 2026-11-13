"use client";

import Image from "next/image";
import { useState } from "react";
import LogoLoader from "./LogoLoader";
import { cn } from "@/lib/utils";

// One photo in a client's gallery grid: the logo loader until it arrives,
// then it fades in. Children sit on top (the heart, a download button…).
export default function ClientPhotoTile({
  src,
  width,
  height,
  label,
  onOpen,
  className,
  children,
}: {
  src: string;
  width: number;
  height: number;
  label: string;
  onOpen: () => void;
  className?: string;
  children?: React.ReactNode;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className={cn("relative mb-3 break-inside-avoid bg-cream/5", className)}>
      <button onClick={onOpen} aria-label={label} className="block w-full">
        <Image
          src={src}
          alt=""
          width={width}
          height={height}
          unoptimized
          draggable={false}
          onContextMenu={(e) => e.preventDefault()}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
          className={cn("h-auto w-full transition-opacity duration-500", loaded ? "opacity-100" : "opacity-0")}
        />
      </button>
      {!loaded && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <LogoLoader label="Loading photo" className="size-10 text-cream/40" />
        </span>
      )}
      {children}
    </div>
  );
}
