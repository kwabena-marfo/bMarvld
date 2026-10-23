import type { Metadata, Viewport } from "next";
import { Josefin_Sans, Montserrat } from "next/font/google";
import ThemeToggle, { ThemeProvider } from "@/components/ThemeToggle";
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

const description =
  "Studio portraits, fashion, kids and graduation photography by Bright Marvl of B.Marvld. ...be marveled.";

// Favicon, app icons and the social share image come from the icon.png,
// apple-icon.png, favicon.ico and opengraph-image.png files in this folder.
export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: { default: "B.Marvld — Photography", template: "%s — B.Marvld" },
  description,
  openGraph: { title: "B.Marvld — Photography", description, siteName: "B.Marvld", type: "website" },
  twitter: { card: "summary_large_image" },
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
