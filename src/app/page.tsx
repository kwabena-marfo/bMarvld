import Image from "next/image";
import { Suspense } from "react";
import { Aperture, Bokeh, Camera, CameraTripod, Softbox } from "@/components/Backdrops";
import GallerySection, { GallerySkeleton } from "@/components/GallerySection";
import ClientFavourites from "@/components/ClientFavourites";
import Logo from "@/components/Logo";
import SectionHeading from "@/components/SectionHeading";
import { BookingSection, PackagesGrid, SectionSkeleton } from "@/components/PackagesSection";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { buttonVariants } from "@/components/ui/button";
import { heroLeft, heroRight, studioBackdrop } from "@/data/gallery";
import { SITE_URL } from "@/lib/siteUrl";
import { cn } from "@/lib/utils";

// Tells Google who B.Marvld is, so searches for the name or for photographers
// in Accra can show the business properly.
const businessJsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  "@id": `${SITE_URL}/#business`,
  name: "B.Marvld Photography",
  alternateName: ["B.Marvld", "BMarvld"],
  description: "Studio portraits, fashion, kids and graduation photography in Accra, Ghana by Bright Marvl.",
  url: SITE_URL,
  image: `${SITE_URL}/brand/b-marvld.jpg`,
  logo: `${SITE_URL}/icon.png`,
  slogan: "...be marveled",
  founder: { "@type": "Person", name: "Bright Marvl", jobTitle: "Photographer" },
  address: { "@type": "PostalAddress", addressLocality: "Accra", addressCountry: "GH" },
  areaServed: { "@type": "Country", name: "Ghana" },
  sameAs: ["https://instagram.com/b.marvld"],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(businessJsonLd).replace(/</g, "\\u003c") }}
      />
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative flex min-h-svh items-center justify-center overflow-hidden px-4">
          {/* Two portraits either side, each fading out toward the centre so the
              logo sits on clear black between them. */}
          <div className="absolute inset-y-0 left-0 w-1/2 mask-[linear-gradient(to_right,black_35%,transparent)] md:w-[46%]">
            <Image
              src={heroLeft.src}
              alt=""
              fill
              priority
              sizes="(min-width: 768px) 46vw, 50vw"
              className="object-cover object-[center_15%]"
            />
          </div>
          {/* On phones her face would land in the fade, so the crop shifts her toward the
              solid outer edge and the solid band is wider. */}
          <div className="absolute inset-y-0 right-0 w-1/2 mask-[linear-gradient(to_left,black_50%,transparent)] md:w-[46%] md:mask-[linear-gradient(to_left,black_35%,transparent)]">
            <Image
              src={heroRight.src}
              alt=""
              fill
              priority
              sizes="(min-width: 768px) 46vw, 50vw"
              className="object-cover object-[35%_25%] md:object-[center_25%]"
            />
          </div>
          {/* Brand-coloured tint: warm gold at the outer edges deepening to black in the
              middle behind the logo, then a fade into the next section. */}
          <div className="absolute inset-0 bg-linear-to-r from-gold/25 via-ink/75 to-gold/25" />
          <div className="absolute inset-0 bg-linear-to-b from-ink/30 via-transparent to-ink" />
          <Bokeh className="opacity-70" />
          <div className="relative flex flex-col items-center pt-16 text-center">
            {/* A slowly turning lens aperture above the framed logo. It's sized from the
                screen height so the frame below it still fits. */}
            <Aperture className="size-[min(70vw,36svh,28rem)] animate-[spin_120s_linear_infinite] text-gold opacity-20 motion-reduce:animate-none" />
            <div className="viewfinder relative mt-6 px-8 py-8 text-cream/80 sm:px-14 sm:py-10">
              <span className="absolute top-5 right-5 size-2.5 rounded-full bg-gold" aria-hidden />
              <h1 className="text-cream">
                <Logo tagline className="text-3xl sm:text-5xl md:text-6xl" />
              </h1>
              <p className="mx-auto mt-5 max-w-md text-sm text-cream-dim">
                Studio portraits, fashion, kids and milestone moments, captured so you can be marveled, again and again.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <a href="#book" className={buttonVariants({ size: "lg" })}>
                  Book a session
                </a>
                <a href="#work" className={buttonVariants({ size: "lg", variant: "outline" })}>
                  View work
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Work */}
        <section id="work" className="relative isolate mx-auto max-w-384 scroll-mt-16 px-4 py-24 sm:px-6 lg:px-10">
          {/* The full logo as a faint watermark behind the heading. */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-10 -z-10 flex justify-center opacity-[0.06] blur-[1px]">
            <Logo mark className="text-[11vw] 2xl:text-[10rem]" />
          </div>
          <SectionHeading eyebrow="Portfolio" title="Selected work" />
          <Suspense fallback={<GallerySkeleton />}>
            <GallerySection />
          </Suspense>
        </section>

        {/* Edits clients chose to share; the section only appears once there are some. */}
        <Suspense fallback={null}>
          <ClientFavourites />
        </Suspense>

        {/* About */}
        <section id="about" className="relative isolate scroll-mt-16 overflow-hidden bg-cream text-ink">
          <Camera className="absolute -right-16 -bottom-10 -z-10 w-104 -rotate-12 opacity-[0.08] blur-[0.5px] md:w-136" />
          <Aperture className="absolute -top-24 -left-24 -z-10 size-80 opacity-[0.07]" />
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
              <h2 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">
                Some stories are told in words, others in light.
              </h2>
              <p className="mt-6 leading-relaxed">
                At B.MARVLD, we notice the quiet spaces, the soft glances, the tiny pauses, the moments too quick to
                keep. Every pose is a statement waiting to be told, every frame a story waiting to unfold, and every
                click of the shutter a moment made timeless.
              </p>
              <p className="mt-4 leading-relaxed">
                To us, photography is not merely about what the camera sees, but what the heart remembers. It&apos;s
                about preserving the beauty of now, giving memories a place to live, and allowing moments to outlast
                the time they happened.
              </p>
              <p className="mt-4 leading-relaxed">
                Here at B.MARVLD, we make photos feel like stories you want to read again and again.
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
        <section id="packages" className="relative isolate scroll-mt-16 overflow-hidden">
          {/* Studio lights either side; the package cards sit on a blurred panel over them. */}
          <Softbox className="absolute bottom-0 -left-10 -z-10 h-88 text-cream opacity-[0.12] blur-[1px] md:left-4 md:h-120" />
          <CameraTripod className="absolute -right-10 bottom-0 -z-10 h-88 text-cream opacity-[0.12] blur-[1px] md:right-4 md:h-120" />
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <SectionHeading eyebrow="Pricing" title="Packages" />
            <Suspense fallback={<SectionSkeleton />}>
              <PackagesGrid />
            </Suspense>
          </div>
        </section>

        {/* Booking */}
        <section
          id="book"
          className="relative isolate scroll-mt-16 overflow-hidden border-t border-cream/10 bg-ink-soft/50 in-[.light]:bg-[#e6c99e]"
        >
          {/* A studio set, softly out of focus. The form sits on its own solid panel,
              so the photo only shows around and faintly through it. */}
          <Image
            src={studioBackdrop.src}
            alt=""
            fill
            sizes="100vw"
            className="-z-10 object-cover object-[center_30%] opacity-30 blur-[3px] in-[.light]:opacity-25"
          />
          <div className="absolute inset-0 -z-10 bg-linear-to-b from-ink/60 via-transparent to-ink/70" />
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <SectionHeading eyebrow="Reserve your date" title="Book a session" />
            <div className="border border-cream/10 bg-ink/85 p-5 shadow-2xl shadow-black/30 backdrop-blur-md sm:p-10">
              <Suspense fallback={<SectionSkeleton height="h-[40rem]" />}>
                <BookingSection />
              </Suspense>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
