import type { Metadata, Viewport } from "next";
import { Josefin_Sans, Montserrat } from "next/font/google";
import ThemeToggle, { ThemeProvider } from "@/components/ThemeToggle";
import { SITE_URL } from "@/lib/siteUrl";
import "./globals.css";

// Josefin Sans echoes the geometric, high-waisted letterforms of the logo;
// Montserrat matches its widely tracked "...be marveled" tagline.
const josefin = Josefin_Sans({
  variable: "--font-josefin",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

const title = "B.Marvld Photography | Photographer in Accra, Ghana";
const description =
  "Studio portraits, fashion, kids and graduation photography in Accra, Ghana by Bright Marvl of B.Marvld. See the work and book your session online. ...be marveled.";

// Favicon, app icons and the social share image come from the icon.png,
// apple-icon.png, favicon.ico and opengraph-image.png files in this folder.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: title, template: "%s | B.Marvld" },
  description,
  applicationName: "B.Marvld",
  keywords: ["B.Marvld", "BMarvld", "Bright Marvl", "photographer Accra", "photography Ghana", "studio portraits Accra"],
  alternates: { canonical: "/" },
  openGraph: { title, description, siteName: "B.Marvld", type: "website", url: "/", locale: "en_GH" },
  twitter: { card: "summary_large_image", title, description },
};

export const viewport: Viewport = {
  themeColor: "#050505",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // next-themes sets the theme class on <html> before hydration, hence the warning suppression.
    <html lang="en" suppressHydrationWarning className={`${josefin.variable} ${montserrat.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <ThemeProvider>
          {children}
          <ThemeToggle />
        </ThemeProvider>
      </body>
    </html>
  );
}
