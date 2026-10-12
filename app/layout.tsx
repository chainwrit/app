import type { Metadata } from "next";
import { JetBrains_Mono, Schibsted_Grotesk } from "next/font/google";
import Providers from "@/components/Providers";
import Header from "@/components/Header";
import "./globals.css";

const sans = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-schibsted" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "Chainwrit app",
  description: "Create and manage on-chain spending mandates for your AI agents. Devnet.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        <Providers>
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <Header />
            <main className="pb-20">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
