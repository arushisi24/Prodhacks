import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FAFSA Buddy",
  description: "Your guide to FAFSA and financial aid",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
