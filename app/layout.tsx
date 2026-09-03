import { Toaster } from "sonner";
import type { Metadata, Viewport } from "next";
import { Mona_Sans } from "next/font/google";

import "./globals.css";

const monaSans = Mona_Sans({
  variable: "--font-mona-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "BrihatX AI Interview",
    template: "%s | BrihatX AI Interview",
  },
  description: "Focused AI interview practice with realistic voice sessions and actionable feedback.",
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#10100f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${monaSans.variable} site-body antialiased`}>
        {children}

        <Toaster />
      </body>
    </html>
  );
}
