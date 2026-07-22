import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { NavBar } from "@/components/nav-bar";
import { PushPromptBanner } from "@/components/push/push-prompt-banner";
import { BankAccountPromptBanner } from "@/components/profile/bank-account-prompt-banner";
import { SplashScreen } from "@/components/splash-screen";
import { ErrorReporter } from "@/components/error-reporter";

/** Static stand-in rendered while the real NavBar (which awaits the
 * auth/profile lookup) streams in - keeps the very first HTML flush
 * instant so the splash/loader shows as early as possible. */
function NavBarFallback() {
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 dark:border-neutral-800 bg-black">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <Link href="/" className="whitespace-nowrap font-bold tracking-tight text-white">
          OKTAGON <span className="text-accent">GARÁŽ</span>
          <span className="hidden sm:inline"> Tipovačka</span>
        </Link>
      </div>
    </header>
  );
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OKTAGON GARÁŽ Tipovačka",
  description: "Tipovačka na galavečery OKTAGON MMA",
  appleWebApp: {
    title: "OKTAGON GARÁŽ Tipovačka",
    statusBarStyle: "black",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="cs"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <SplashScreen />
        <ErrorReporter />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Suspense fallback={<NavBarFallback />}>
            <NavBar />
          </Suspense>
          <PushPromptBanner />
          <BankAccountPromptBanner />
          <main className="mx-auto w-full max-w-3xl flex-1 pb-24 md:pb-0">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
