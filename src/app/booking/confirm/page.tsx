import Link from "next/link";
import { Suspense } from "react";
import Logo from "@/components/Logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { confirmBooking } from "@/lib/bookings";
import { formatCedis } from "@/data/packages";

// Paystack redirects here with ?reference=… after checkout.
export default function ConfirmPage({ searchParams }: PageProps<"/booking/confirm">) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-4 py-16">
      <Link href="/" className="mb-12 text-2xl">
        <Logo />
      </Link>
      <div className="viewfinder w-full max-w-lg p-10 text-center text-cream/40">
        <div className="text-cream">
          <Suspense fallback={<p className="text-cream-dim">Confirming your payment…</p>}>
            <Result searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

async function Result({ searchParams }: Pick<PageProps<"/booking/confirm">, "searchParams">) {
  const { reference } = await searchParams;
  const booking = typeof reference === "string" ? await confirmBooking(reference).catch(() => null) : null;

  if (!booking) {
    return (
      <Message title="Booking not found">
        We couldn&apos;t find that booking. If you were charged, please reach out with your payment receipt.
      </Message>
    );
  }

  if (booking.status === "deposit_paid") {
    return (
      <>
        <p className="text-xs tracking-[0.4em] text-gold uppercase">● Confirmed</p>
        <h1 className="mt-3 font-display text-4xl font-semibold">You&apos;re booked!</h1>
        <p className="mt-4 text-cream-dim">
          Thanks, {booking.name.split(" ")[0]}. Your {formatCedis(booking.deposit)} deposit has been received and your
          date is locked in. We&apos;ll be in touch on {booking.phone} to plan the shoot.
        </p>
        <dl className="mt-8 space-y-2 border-t border-cream/10 pt-6 text-left text-sm">
          <Row label="Reference" value={booking.reference} />
          <Row label="Package" value={booking.packageName} />
          <Row label="Date" value={`${booking.date} at ${booking.time}`} />
          <Row label="Location" value={booking.location} />
          <Row label="Balance due on the day" value={formatCedis(booking.price - booking.deposit)} />
        </dl>
        <BackHome />
      </>
    );
  }

  return (
    <Message title={booking.status === "failed" ? "Payment failed" : "Payment not completed"}>
      Your deposit didn&apos;t go through, so the date isn&apos;t reserved yet. You can try booking again.
    </Message>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-cream-dim">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <h1 className="font-display text-3xl font-semibold">{title}</h1>
      <p className="mt-4 text-cream-dim">{children}</p>
      <BackHome />
    </>
  );
}

function BackHome() {
  return (
    <Link href="/#book" className={cn(buttonVariants({ size: "lg" }), "mt-8")}>
      Back to site
    </Link>
  );
}
