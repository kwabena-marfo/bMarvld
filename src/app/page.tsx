import Image from "next/image";
import { Suspense } from "react";
import GallerySection, { GallerySkeleton } from "@/components/GallerySection";
import Logo from "@/components/Logo";
import { BookingSection, PackagesGrid, SectionSkeleton } from "@/components/PackagesSection";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { buttonVariants } from "@/components/ui/button";
import { heroShot } from "@/data/gallery";
import { cn } from "@/lib/utils";

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-12 text-center">
      <p className="text-xs tracking-[0.4em] text-gold uppercase">{eyebrow}</p>
      <h2 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">{title}</h2>
    </div>
  );
}

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative flex min-h-svh items-center justify-center overflow-hidden px-4">
          <Image
            src={heroShot.src}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-[center_30%] opacity-50"
          />
          <div className="absolute inset-0 bg-linear-to-b from-ink/60 via-ink/30 to-ink" />
          <div className="viewfinder relative px-8 py-14 text-center text-cream/80 sm:px-16">
            <span className="absolute top-6 right-6 h-3 w-3 rounded-full bg-gold" aria-hidden />
            <h1 className="text-cream">
              <Logo tagline className="text-5xl sm:text-7xl md:text-8xl" />
            </h1>
            <p className="mx-auto mt-8 max-w-md text-sm text-cream-dim">
              Studio portraits, fashion, kids and milestone moments — captured so you can be marveled, again and again.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <a href="#book" className={buttonVariants({ size: "lg" })}>
                Book a session
              </a>
              <a href="#work" className={buttonVariants({ size: "lg", variant: "outline" })}>
                View work
              </a>
            </div>
          </div>
        </section>

        {/* Work */}
        <section id="work" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-24 sm:px-6">
          <SectionHeading eyebrow="Portfolio" title="Selected work" />
          <Suspense fallback={<GallerySkeleton />}>
            <GallerySection />
          </Suspense>
        </section>

        {/* About */}
        <section id="about" className="scroll-mt-16 bg-cream text-ink">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-24 sm:px-6 md:grid-cols-2">
            <div className="viewfinder relative mx-auto aspect-3/4 w-full max-w-md p-4">
              <div className="relative h-full w-full">
                <Image
                  src="/brand/b-marvld.jpg"
                  alt="Bright Marvl, the photographer behind B.Marvld, with his camera"
                  fill
                  sizes="(min-width: 768px) 448px, 100vw"
                  className="object-cover"
                />
              </div>
            </div>
            <div>
              <p className="text-xs tracking-[0.4em] uppercase">
                <span className="text-gold">●</span> About
              </p>
              <h2 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">Hi, I&apos;m Bright Marvl</h2>
              <p className="mt-6 leading-relaxed">
                I&apos;m a photographer who believes every frame should make you stop and stare. From bold studio
                portraits and tailored fashion looks to kids&apos; shoots and graduation days, I chase light, styling
                and honest emotion — the details that turn a photo into an heirloom.
              </p>
              <p className="mt-4 leading-relaxed">
                Every session is relaxed, directed and tailored to you — so all you have to do is show up and be
                yourself. I&apos;ll take care of the rest.
              </p>
              <a
                href="#book"
                className={cn(buttonVariants({ size: "lg" }), "mt-8 bg-ink text-cream hover:bg-ink-soft")}
              >
                Let&apos;s work together
              </a>
            </div>
          </div>
        </section>

        {/* Packages */}
        <section id="packages" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-24 sm:px-6">
          <SectionHeading eyebrow="Pricing" title="Packages" />
          <Suspense fallback={<SectionSkeleton />}>
            <PackagesGrid />
          </Suspense>
        </section>

        {/* Booking */}
        <section id="book" className="scroll-mt-16 border-t border-cream/10 bg-ink-soft/50">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <SectionHeading eyebrow="Reserve your date" title="Book a session" />
            <Suspense fallback={<SectionSkeleton height="h-[40rem]" />}>
              <BookingSection />
            </Suspense>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
