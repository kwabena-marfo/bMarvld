import Logo from "./Logo";

export default function SiteFooter() {
  return (
    <footer className="border-t border-cream/10 px-4 py-12 text-center sm:px-6">
      <Logo tagline className="text-3xl" />
      <p className="mt-8 text-xs tracking-[0.2em] text-cream-dim uppercase">
        Accra, Ghana ·{" "}
        <a href="https://instagram.com/b.marvld" className="hover:text-gold">
          Instagram
        </a>
      </p>
      <p className="mt-2 text-xs text-cream-dim/60">© B.Marvld Photography</p>
    </footer>
  );
}
