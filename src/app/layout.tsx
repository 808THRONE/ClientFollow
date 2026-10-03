import React from "react";
import "./globals.css";

export const metadata = {
  title: "ClientFollow — Automated Follow-Up & Revenue Recovery",
  description: "Automated follow-up engine for dentists, agencies, photographers, lawyers, and contractors.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
