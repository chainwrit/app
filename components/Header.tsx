"use client";

import Link from "next/link";
import dynamic from "next/dynamic";

// The wallet button reads browser-only state; render it on the client only.
const WalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false },
);

export default function Header() {
  return (
    <header className="flex items-center justify-between gap-4 py-5">
      <div className="flex items-center gap-3">
        <Link href="/">
          <img src={`${process.env.NEXT_PUBLIC_BASE_PATH}/logo-lockup.svg`} alt="Chainwrit" className="h-7 w-auto" />
        </Link>
        <span className="rounded border border-line px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">
          devnet
        </span>
      </div>
      <div className="flex items-center gap-4">
        <a href="https://chainwrit.com" className="hidden text-sm text-muted hover:text-fg sm:inline">
          About
        </a>
        <WalletMultiButton />
      </div>
    </header>
  );
}
