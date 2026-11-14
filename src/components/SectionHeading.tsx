export default function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-12 text-center">
      <p className="text-xs tracking-[0.4em] text-gold uppercase">{eyebrow}</p>
      <h2 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">{title}</h2>
    </div>
  );
}
