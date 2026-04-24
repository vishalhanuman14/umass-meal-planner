import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UMass Nutrition Web",
  description: "Warm, minimal web access to today's UMass dining meal plan.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
