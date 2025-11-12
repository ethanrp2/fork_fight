import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SWRProvider from "@/components/providers/SWRProvider";
import BottomNav from "@/components/BottomNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ForkFight",
  description: "Swipe-style restaurant rankings for UIUC, powered by ELO.",
  icons: {
    icon: "/icons/survey.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#741B3F",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white`}
      >
        <SWRProvider>
          <div className="w-full max-w-[480px] mx-auto min-h-screen min-h-screen-safe main-scroll-area pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom))] overflow-x-hidden">
            <main className="px-4">{children}</main>
          </div>
          <BottomNav />
        </SWRProvider>
      </body>
    </html>
  );
}
