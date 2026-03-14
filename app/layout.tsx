import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Robotics Challenge 2026 Registration",
  description:
    "College robotics event registration and QR ticket booking system powered by Next.js.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`min-h-screen bg-slate-950 text-slate-50 antialiased ${inter.className}`}>
        {children}
      </body>
    </html>
  );
}
