import { cn } from "@/lib/utils";

// Decorative layers that sit behind page sections: out-of-focus bokeh, a lens
// aperture, and thin line drawings of studio gear. All are aria-hidden, ignore
// the pointer, and take their colour from `currentColor` so they follow the theme.

type ArtProps = { className?: string };

const line = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

// Soft out-of-focus highlights, like light points shot wide open.
const bokeh = [
  { x: "22%", y: "30%", size: "9rem", tone: "bg-gold/30" },
  { x: "70%", y: "22%", size: "6rem", tone: "bg-cream/20" },
  { x: "60%", y: "68%", size: "11rem", tone: "bg-gold/20" },
  { x: "35%", y: "75%", size: "5rem", tone: "bg-cream/25" },
  { x: "80%", y: "55%", size: "4rem", tone: "bg-gold/35" },
  { x: "12%", y: "60%", size: "6rem", tone: "bg-gold/15" },
  { x: "48%", y: "12%", size: "4.5rem", tone: "bg-gold/25" },
];

export function Bokeh({ className }: ArtProps) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0", className)}>
      {bokeh.map((b, i) => (
        <span
          key={i}
          className={cn("absolute -translate-1/2 rounded-full blur-2xl", b.tone)}
          style={{ left: b.x, top: b.y, width: b.size, height: b.size }}
        />
      ))}
    </div>
  );
}

// A six-bladed lens aperture inside the lens barrel's rings.
export function Aperture({ className }: ArtProps) {
  const blades = Array.from({ length: 6 }, (_, i) => {
    const a = (i * Math.PI) / 3;
    const b = a + Math.PI / 3;
    // Each blade edge runs from the outer ring to the opposite side of the hexagonal opening.
    return {
      x1: 78 * Math.cos(a),
      y1: 78 * Math.sin(a),
      x2: 30 * Math.cos(b + Math.PI / 6),
      y2: 30 * Math.sin(b + Math.PI / 6),
    };
  });
  return (
    <svg aria-hidden viewBox="-100 -100 200 200" className={cn("pointer-events-none", className)} {...line} strokeWidth={0.8}>
      <circle r="97" />
      <circle r="90" strokeDasharray="1 4" />
      <circle r="78" />
      {blades.map((b, i) => (
        <line key={i} {...b} />
      ))}
      <polygon
        points={Array.from({ length: 6 }, (_, i) => {
          const a = (i * Math.PI) / 3 + Math.PI / 6;
          return `${30 * Math.cos(a)},${30 * Math.sin(a)}`;
        }).join(" ")}
      />
    </svg>
  );
}

// Softbox on a three-legged light stand.
export function Softbox({ className }: ArtProps) {
  return (
    <svg aria-hidden viewBox="0 0 200 420" className={cn("pointer-events-none", className)} {...line}>
      <path d="M10 20h180v130H10z" />
      <path d="M30 38h140v94H30z" strokeOpacity={0.5} />
      <path d="M10 20l70 50M190 20l-70 50M10 150l70-50M190 150l-70-50M80 70h40v30H80z" strokeOpacity={0.7} />
      <path d="M100 100v20M92 120h16v14H92zM100 134v226" />
      <path d="M96 200h8M96 280h8" />
      <path d="M100 360l-60 55M100 360l60 55M100 360v50M70 388h60" />
    </svg>
  );
}

// Camera body with a lens, mounted on a tripod.
export function CameraTripod({ className }: ArtProps) {
  return (
    <svg aria-hidden viewBox="0 0 240 420" className={cn("pointer-events-none", className)} {...line}>
      <path d="M40 70h160a10 10 0 0 1 10 10v70a10 10 0 0 1-10 10H40a10 10 0 0 1-10-10V80a10 10 0 0 1 10-10z" />
      <path d="M90 70l10-22h40l10 22M48 60h22v10M170 82h18" />
      <circle cx="120" cy="115" r="34" />
      <circle cx="120" cy="115" r="22" strokeOpacity={0.6} />
      <circle cx="120" cy="115" r="8" />
      <path d="M108 160h24v18h-24zM120 178v120" />
      <path d="M120 298l-80 115M120 298l80 115M120 298v105M80 356h80" />
    </svg>
  );
}

// Handheld camera, for small spots.
export function Camera({ className }: ArtProps) {
  return (
    <svg aria-hidden viewBox="0 0 240 170" className={cn("pointer-events-none", className)} {...line}>
      <path d="M20 40h200a10 10 0 0 1 10 10v100a10 10 0 0 1-10 10H20a10 10 0 0 1-10-10V50a10 10 0 0 1 10-10z" />
      <path d="M78 40l14-28h56l14 28M30 30h28v10M180 58h24" />
      <circle cx="120" cy="100" r="46" />
      <circle cx="120" cy="100" r="32" strokeOpacity={0.6} />
      <circle cx="120" cy="100" r="14" />
      <path d="M100 82a28 28 0 0 1 22-10" strokeOpacity={0.6} />
    </svg>
  );
}
