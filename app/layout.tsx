import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-50 antialiased">
        {children}
      </body>
    </html>
  );
}

