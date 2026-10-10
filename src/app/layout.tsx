import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pocket CFO — Autonomous AI agent for PayPal cash flow",
  description:
    "Pocket CFO scores invoice risk, negotiates early-payment discounts, chases overdue clients, and auto-splits incoming PayPal payments into tax, reinvestment, buffer, and take-home pots — fully autonomously.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
