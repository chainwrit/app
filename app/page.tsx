"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { listMandatesByOwner, type MandateView } from "@chainwrit/sdk";
import Balances from "@/components/Balances";
import MandateStatus from "@/components/MandateStatus";
import { fmt, short } from "@/lib/chain";

const STEPS = [
  ["Create a mandate", "Name your agent's key, the merchants it may pay, a per-payment cap, a daily cap and an expiry."],
  ["Fund the vault", "Deposit tokens into a vault owned by the program. No private key exists for it."],
  ["Give your agent the key", "It can request payments. The program refuses anything outside the mandate."],
];

export default function Dashboard() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const [mandates, setMandates] = useState<MandateView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!publicKey) return setMandates(null);
    try {
      setMandates(await listMandatesByOwner(connection, publicKey));
      setError(null);
    } catch (e: any) {
      setError(`Could not load mandates: ${e.message}`);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    load();
  }, [load]);

  if (!publicKey) {
    return (
      <section className="py-16 sm:py-24">
        <p className="mb-4 font-mono text-xs uppercase tracking-widest text-accent">Mandates</p>
        <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Set what your AI agents can spend.
        </h1>
        <p className="mt-5 max-w-xl text-muted">
          Connect a Solana wallet to create spending mandates, fund them, watch every payment your agents make, and
          revoke access in one click. Runs on devnet with a test token.
        </p>
        <button onClick={() => setVisible(true)} className="mt-8 rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-black hover:opacity-90">
          Connect wallet
        </button>
        <div className="mt-16 grid gap-4 md:grid-cols-3">
          {STEPS.map(([title, body], i) => (
            <div key={title} className="rounded-lg border border-line bg-panel p-5">
              <div className="mb-2 font-mono text-xs text-accent">0{i + 1}</div>
              <h3 className="mb-1 font-medium">{title}</h3>
              <p className="text-sm text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your mandates</h1>
          <p className="text-sm text-muted">Owned by {short(publicKey.toBase58())}</p>
        </div>
        <Link href="/new" className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-black hover:opacity-90">
          New mandate
        </Link>
      </div>

      <Balances onChange={load} />

      {error && <p className="rounded-lg border border-bad/40 p-4 text-sm text-bad">{error}</p>}
      {mandates === null && !error && <p className="text-sm text-muted">Loading…</p>}
      {mandates?.length === 0 && (
        <div className="rounded-lg border border-dashed border-line p-10 text-center">
          <p className="text-muted">No mandates yet.</p>
          <p className="mt-1 text-sm text-muted">
            Grab some test dUSDC above, then{" "}
            <Link href="/new" className="text-accent hover:underline">create your first mandate</Link>.
          </p>
        </div>
      )}

      <div className="grid gap-3">
        {mandates?.map((m) => {
          const used = Number(m.dailyLimit) ? Math.min(100, (Number(m.spentInWindow) / Number(m.dailyLimit)) * 100) : 0;
          return (
            <Link
              key={m.address.toBase58()}
              href={`/m/${m.address.toBase58()}`}
              className="block rounded-lg border border-line bg-panel p-4 transition-colors hover:border-muted"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-wider text-muted">Agent</div>
                  <div className="addr text-sm">{m.agent.toBase58()}</div>
                </div>
                <MandateStatus m={m} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <div className="text-xs text-muted">Vault</div>
                  <div>{fmt(m.vaultBalance)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Per payment</div>
                  <div>{fmt(m.maxPerPayment)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Today</div>
                  <div>
                    {fmt(m.spentInWindow)} / {fmt(m.dailyLimit)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted">Merchants</div>
                  <div>{m.merchants.length}</div>
                </div>
              </div>
              <div className="mt-3 h-1 overflow-hidden rounded bg-line">
                <div className="h-full bg-accent" style={{ width: `${used}%` }} />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
