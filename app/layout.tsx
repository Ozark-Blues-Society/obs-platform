import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ozark Blues Society",
  description: "The Ozark Blues Society website (in development).",
};

// Fonts (DM Serif Display + Inter) and design tokens arrive with D-1; the layout shell with D-2.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-white text-neutral-900">{children}</body>
    </html>
  );
}
