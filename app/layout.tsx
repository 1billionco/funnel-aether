import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";

import { TooltipProvider } from "@/components/ui/primitives";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  // Lite mode (M1) is decided on the server; when it's on, these font
  // variables are not attached and the system stack is used instead (§7.3).
  const fontVars = `${geistSans.variable} ${geistMono.variable} ${fraunces.variable}`;
  return (
    <html lang="en-GB" className={fontVars} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
