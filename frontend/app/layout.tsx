import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Sora } from "next/font/google";
import "./globals.css";

const sora = Sora({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--f-sora" });
const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--f-plex" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--f-plexmono" });

export const metadata: Metadata = {
  title: { default: "NEXUS · Architecture Workbench", template: "%s · NEXUS" },
  description: "Design in plain language. Find the bottleneck before it ships.",
  icons: { icon: "/nexus.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${plex.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
