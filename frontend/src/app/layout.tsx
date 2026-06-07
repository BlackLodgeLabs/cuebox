import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Film Picker",
  description: "Choose what to watch from your Letterboxd watchlist",
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
