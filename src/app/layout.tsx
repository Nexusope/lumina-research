import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Lumina Research",
  description: "AI research workspace with cited evidence, source scoring, charts, exports, and live retrieval.",
  keywords: ["AI research", "Context.dev", "OpenAI", "citations", "research reports"],
  openGraph: {
    title: "Lumina Research",
    description: "Ask any research question and get a cited, confidence-scored report.",
    type: "website"
  }
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
