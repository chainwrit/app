"use client";

import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

export default function Providers({ children }: { children: React.ReactNode }) {
  // All RPC goes through our own /api/rpc proxy. Wallets that implement the
  // Wallet Standard (Phantom, Solflare, Backpack) are detected automatically.
  const endpoint = useMemo(
    () => (typeof window === "undefined" ? "http://localhost/api/rpc" : `${window.location.origin}/api/rpc`),
    [],
  );

  return (
    <ConnectionProvider endpoint={endpoint} config={{ commitment: "confirmed", wsEndpoint: "wss://api.devnet.solana.com" }}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
