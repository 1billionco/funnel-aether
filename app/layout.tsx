import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";

import { TooltipProvider } from "@/components/ui/primitives";
import { isLiteMode } from "@/lib/lite-mode.server";
import "./globals.css";

// preload: false so Lite mode (which omits the font variables) never fetches
// font files; in full mode they load as soon as CSS references them.
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"], preload: false });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], preload: false });
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
  preload: false,
});

export const metadata: Metadata = {
  title: { default: "Funnel Aether", template: "%s · Funnel Aether" },
  description: "Your whole marketing funnel in one place — AI drafts, you decide.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F5F0" },
    { media: "(prefers-color-scheme: dark)", color: "#111318" },
  ],
};

// Applies a saved theme override before first paint so there's no flash.
const themeScript = `try{var t=localStorage.getItem("fa-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Lite mode is decided on the server (§7.3). When it's on, the font
  // variables are not attached, so the browser never downloads web fonts and
  // the system stack is used instead.
  const lite = await isLiteMode();
  const fontVars = lite ? "" : `${geistSans.variable} ${geistMono.variable} ${fraunces.variable}`;
  return (
    <html
      lang="en-GB"
      className={fontVars}
      data-lite={lite ? "" : undefined}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
