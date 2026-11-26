import type { Metadata } from "next";
import { DM_Serif_Display, Inter } from "next/font/google";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ozark Blues Society",
  description: "The Ozark Blues Society website (in development).",
};

// next/font downloads the fonts at build time and serves them from this site, so visitors'
// browsers never contact Google. app/globals.css maps the variables to font-sans and font-serif.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const dmSerifDisplay = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-dm-serif-display",
});

// The layout shell (header, footer) arrives with D-2.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${dmSerifDisplay.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
