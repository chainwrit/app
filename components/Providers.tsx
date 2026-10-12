"use client";

import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import "@solana/wallet-adapter-react-ui/styles.css";

export default function Providers({ children }: { children: React.ReactNode }) {
  // All RPC goes through our own /api/rpc proxy. Wallets that implement the
  // Wallet Standard (Phantom, Solflare, Backpack) are detected automatically.
  // Phantom is also listed explicitly so it shows up with an install link when
  // the browser hasn't exposed it, instead of an empty wallet list.
  const endpoint = useMemo(
    () => (typeof window === "undefined" ? "http://localhost/api/rpc" : `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH}/api/rpc`),
    [],
  );
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint} config={{ commitment: "confirmed", wsEndpoint: "wss://api.devnet.solana.com" }}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
