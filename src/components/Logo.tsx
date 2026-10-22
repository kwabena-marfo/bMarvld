// Text rendition of the B.Marvld wordmark (see public/brand for the originals),
// so it stays crisp at nav size and inherits the surrounding text colour.
export default function Logo({ tagline = false, className = "" }: { tagline?: boolean; className?: string }) {
  return (
    <span className={`inline-flex flex-col items-center leading-none ${className}`}>
      <span className="font-display font-bold tracking-[0.08em]">
        B<span className="text-gold">.</span>MARVLD
      </span>
      {tagline && (
        <span className="mt-[0.6em] text-[0.28em] font-normal tracking-[0.6em] opacity-90">...be marveled</span>
      )}
    </span>
  );
}
