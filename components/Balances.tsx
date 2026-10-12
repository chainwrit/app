"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { MINT, SYMBOL, explorerTx } from "@/lib/chain";

/** SOL and dUSDC balances of the connected wallet, with the test faucet. */
export default function Balances({ onChange }: { onChange?: () => void }) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [sol, setSol] = useState<number | null>(null);
  const [dusdc, setDusdc] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; link?: string; bad?: boolean } | null>(null);

  const load = useCallback(async () => {
    if (!publicKey) return;
    setSol((await connection.getBalance(publicKey)) / LAMPORTS_PER_SOL);
    try {
      const bal = await connection.getTokenAccountBalance(getAssociatedTokenAddressSync(MINT, publicKey));
      setDusdc(bal.value.uiAmount ?? 0);
    } catch {
      setDusdc(0);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    load();
  }, [load]);

  async function faucet() {
    if (!publicKey) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/faucet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: publicKey.toBase58() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setMsg({
        text: `Sent ${body.dusdc} ${SYMBOL}${body.sol ? ` and ${body.sol} SOL for fees` : ""}.`,
        link: explorerTx(body.signature),
      });
      await load();
      onChange?.();
    } catch (e: any) {
      setMsg({ text: e.message, bad: true });
    } finally {
      setBusy(false);
    }
  }

  if (!publicKey) return null;
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-panel p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-6 text-sm">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted">SOL</div>
          <div className="font-medium">{sol === null ? "…" : sol.toFixed(4)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-muted">{SYMBOL}</div>
          <div className="font-medium">{dusdc === null ? "…" : dusdc.toLocaleString()}</div>
        </div>
      </div>
      <div className="flex flex-col items-start gap-1 sm:items-end">
        <button
          onClick={faucet}
          disabled={busy}
          className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-muted disabled:opacity-50"
        >
          {busy ? "Sending…" : `Get 25 test ${SYMBOL}`}
        </button>
        {msg && (
          <span className={`text-xs ${msg.bad ? "text-bad" : "text-muted"}`}>
            {msg.text}{" "}
            {msg.link && (
              <a href={msg.link} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                View ↗
              </a>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
