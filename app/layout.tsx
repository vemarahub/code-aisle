import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Code Aisle — MongoDB code-aware agent",
  description:
    "A code-aware agent built on MongoDB Atlas: Automated Embeddings, voyage-code-4, native $rerank, and Stream Processing.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
