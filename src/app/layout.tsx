import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// Inter ships a Vietnamese subset; Geist doesn't cover all diacritics.
const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin", "vietnamese"],
});

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "ReelRoom", template: "%s · ReelRoom" },
  description: "Thư viện ảnh và video nội bộ",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster richColors />
      </body>
    </html>
  );
}
