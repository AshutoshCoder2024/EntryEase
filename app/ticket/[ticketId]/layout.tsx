import type { Metadata } from "next";
import type { ReactNode } from "react";

/** Tickets are public by link; keep them out of search indexes to reduce leakage of PII. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function TicketLayout({ children }: { children: ReactNode }) {
  return children;
}
