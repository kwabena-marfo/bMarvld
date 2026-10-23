"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";

// Dark is the brand default; the choice is remembered per visitor.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}

// Floating switch at the bottom-right of every page (bottom-left is where the
// Next.js dev-tools badge sits in development). Which icon shows is decided by
// CSS (the `dark` class on <html>), so the server render never mismatches.
export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "light" ? "dark" : "light")}
      aria-label="Switch between dark and light theme"
      title="Switch theme"
      className="fixed right-4 bottom-4 z-50 flex size-12 items-center justify-center rounded-full border border-gold/70 bg-ink-soft/90 text-gold shadow-lg shadow-black/40 backdrop-blur transition hover:scale-105 hover:bg-gold hover:text-primary-foreground"
    >
      <SunIcon className="hidden size-5 dark:block" />
      <MoonIcon className="size-5 dark:hidden" />
    </button>
  );
}
