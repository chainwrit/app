"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import {
  buildDeposit,
  buildRevoke,
  buildWithdraw,
  fetchActivity,
  fetchMandate,
  type ActivityEntry,
  type MandateView,
} from "@chainwrit/sdk";
import MandateStatus, { mandateStatus } from "@/components/MandateStatus";
import { DEMO_MERCHANT, SYMBOL, TxError, explorerAddr, explorerTx, fmt, parseAmount, sendAndConfirm, short } from "@/lib/chain";

const KIND: Record<ActivityEntry["kind"], { label: string; tone: string }> = {
  create: { label: "Created", tone: "text-muted" },
  deposit: { label: "Deposit", tone: "text-fg" },
  pay: { label: "Paid", tone: "text-ok" },
  rejected: { label: "Rejected", tone: "text-bad" },
  revoke: { label: "Revoked", tone: "text-bad" },
  withdraw: { label: "Withdraw", tone: "text-fg" },
  other: { label: "Other", tone: "text-muted" },
};

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

function MandatePage() {
  const { address } = useParams<{ address: string }>();
  const created = useSearchParams().get("created");
  const { connection } = useConnection();
  const wallet = useWallet();

  const [m, setM] = useState<MandateView | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [amount, setAmount] = useState("5");
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ text: string; sig?: string; bad?: boolean } | null>(null);

  let key: PublicKey | null = null;
  try {
    key = new PublicKey(address);
  } catch {}

  const load = useCallback(async () => {
    if (!key) return;
    try {
      const [view, act] = await Promise.all([fetchMandate(connection, key), fetchActivity(connection, key, 30)]);
      setM(view);
      setActivity(act);
      setLoadError(null);
    } catch (e: any) {
      setLoadError(e.message?.includes("Account does not exist") ? "No mandate at this address on devnet." : e.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, address]);

  useEffect(() => {
    load();
  }, [load]);

  if (!key) return <p className="pt-10 text-bad">Not a valid address.</p>;
  if (loadError) return <p className="pt-10 text-bad">{loadError}</p>;
  if (!m) return <p className="pt-10 text-muted">Loading mandate…</p>;

  const isOwner = wallet.publicKey?.equals(m.owner) ?? false;
  const status = mandateStatus(m);
  const now = Date.now() / 1000;
  const resetsIn = Math.max(0, Math.ceil((m.windowResetsAt - now) / 3600));

  async function act(kind: "deposit" | "withdraw" | "revoke") {
    if (!wallet.publicKey || !key) return;
    setResult(null);
    setBusy(kind);
    try {
      let ixs;
      if (kind === "revoke") {
        if (!confirm("Revoke this mandate? The agent will not be able to make any further payments. This cannot be undone.")) return;
        ixs = await buildRevoke(connection, wallet.publicKey, key);
      } else {
        const base = parseAmount(amount);
        ixs = kind === "deposit"
          ? await buildDeposit(connection, wallet.publicKey, key, base)
          : await buildWithdraw(connection, wallet.publicKey, key, base);
      }
      const sig = await sendAndConfirm(connection, wallet, ixs);
      setResult({ text: kind === "revoke" ? "Mandate revoked." : `${kind === "deposit" ? "Deposited" : "Withdrew"} ${amount} ${SYMBOL}.`, sig });
      await load();
    } catch (e: any) {
      setResult({ text: e.message, sig: e instanceof TxError ? e.signature : undefined, bad: true });
    } finally {
      setBusy(null);
    }
  }

  const mcpConfig = JSON.stringify(
    {
      mcpServers: {
        chainwrit: {
          command: "npx",
          args: ["-y", "@chainwrit/mcp-server"],
          env: {
            RPC_URL: "https://api.devnet.solana.com",
            AGENT_KEYPAIR_PATH: `/absolute/path/to/agent-${m.agent.toBase58().slice(0, 6)}.json`,
            MANDATE: m.address.toBase58(),
          },
        },
      },
    },
    null,
    2,
  );

  return (
    <section className="space-y-8 pt-6">
      <div>
        <Link href="/" className="text-sm text-muted hover:text-fg">← Mandates</Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Mandate {short(m.address.toBase58())}</h1>
          <MandateStatus m={m} />
        </div>
        <a href={explorerAddr(m.address.toBase58())} target="_blank" rel="noreferrer" className="addr mt-1 block text-xs text-muted hover:text-fg">
          {m.address.toBase58()} ↗
        </a>
      </div>

      {created && (
        <div className="rounded-lg border border-ok/40 bg-panel p-4 text-sm">
          Mandate created. Give your agent its key and the mandate address below, and every payment it makes will show up here.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Vault" value={fmt(m.vaultBalance)} />
        <Stat label="Per payment" value={fmt(m.maxPerPayment)} />
        <Stat label="Spent today" value={`${fmt(m.spentInWindow)} / ${fmt(m.dailyLimit)}`} sub={m.spentInWindow > 0n ? `resets in ~${resetsIn}h` : undefined} />
        <Stat label="Remaining today" value={fmt(m.remainingToday)} />
        <Stat label="Expires" value={new Date(m.expiresAt * 1000).toLocaleDateString()} sub={status.label} />
        <Stat label="Lifetime" value={`${m.paymentCount} payments`} sub={fmt(m.totalSpent)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-line bg-panel p-4 text-sm">
          <div className="mb-2 text-xs uppercase tracking-wider text-muted">Agent</div>
          <a href={explorerAddr(m.agent.toBase58())} target="_blank" rel="noreferrer" className="addr text-xs hover:text-accent">{m.agent.toBase58()}</a>
          <div className="mb-2 mt-4 text-xs uppercase tracking-wider text-muted">Allowed merchants</div>
          {m.merchants.map((k) => (
            <a key={k.toBase58()} href={explorerAddr(k.toBase58())} target="_blank" rel="noreferrer" className="addr block text-xs text-ok hover:underline">
              ✓ {k.toBase58()}{k.toBase58() === DEMO_MERCHANT ? " (demo data API)" : ""}
            </a>
          ))}
        </div>

        <div className="rounded-lg border border-line bg-panel p-4 text-sm">
          <div className="mb-3 text-xs uppercase tracking-wider text-muted">Owner actions</div>
          {!isOwner ? (
            <p className="text-muted">
              {wallet.publicKey ? "The connected wallet is not this mandate's owner." : "Connect the owner wallet to manage this mandate."}
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  className="w-28 rounded-md border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-accent"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <span className="self-center text-xs text-muted">{SYMBOL}</span>
                <button onClick={() => act("deposit")} disabled={!!busy} className="rounded-md border border-line px-3 text-sm hover:border-muted disabled:opacity-50">
                  {busy === "deposit" ? "…" : "Deposit"}
                </button>
                <button onClick={() => act("withdraw")} disabled={!!busy} className="rounded-md border border-line px-3 text-sm hover:border-muted disabled:opacity-50">
                  {busy === "withdraw" ? "…" : "Withdraw"}
                </button>
              </div>
              {!m.revoked && (
                <button onClick={() => act("revoke")} disabled={!!busy} className="rounded-md border border-bad/50 px-3 py-1.5 text-sm text-bad hover:bg-bad/10 disabled:opacity-50">
                  {busy === "revoke" ? "Revoking…" : "Revoke mandate"}
                </button>
              )}
              <p className="text-xs text-muted">Withdrawing works even after revocation or expiry.</p>
            </div>
          )}
          {result && (
            <p className={`mt-3 text-xs ${result.bad ? "text-bad" : "text-ok"}`}>
              {result.text}{" "}
              {result.sig && <a href={explorerTx(result.sig)} target="_blank" rel="noreferrer" className="underline">View ↗</a>}
            </p>
          )}
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted">Activity</h2>
          <button onClick={load} className="text-xs text-muted hover:text-fg">Refresh</button>
        </div>
        {!activity?.length ? (
          <p className="text-sm text-muted">No activity yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-panel text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Event</th>
                  <th className="px-3 py-2 font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">To / reason</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {activity.map((a, i) => (
                  <tr key={`${a.signature}-${i}`} className="border-t border-line">
                    <td className="whitespace-nowrap px-3 py-2 text-muted">{a.time ? new Date(a.time * 1000).toLocaleString() : ""}</td>
                    <td className={`px-3 py-2 ${KIND[a.kind].tone}`}>{KIND[a.kind].label}</td>
                    <td className="whitespace-nowrap px-3 py-2">{fmt(a.amount)}</td>
                    <td className="px-3 py-2 text-xs">
                      {a.merchant && <span className="addr">{short(a.merchant)}</span>}
                      {a.error && <span className="ml-2 text-bad">{a.error.name}</span>}
                      {a.taskId && !a.error && <span className="ml-2 text-muted">{a.taskId}</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <a href={explorerTx(a.signature)} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline">tx ↗</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted">Connect an agent</h2>
        <p className="mb-3 text-sm text-muted">
          Run the <a href="https://www.npmjs.com/package/@chainwrit/mcp-server" className="text-accent hover:underline">Chainwrit MCP server</a> with
          this agent's key, and any MCP client can pay within this mandate. For Claude Desktop, open Settings → Developer → Edit Config and add
          this to <code className="font-mono text-xs">claude_desktop_config.json</code>, pointing <code className="font-mono text-xs">AGENT_KEYPAIR_PATH</code> at
          the key file you downloaded. Needs Node.js 22 (or 20.18+).
        </p>
        <pre className="overflow-x-auto rounded-lg border border-line bg-panel p-4 font-mono text-xs leading-relaxed">{mcpConfig}</pre>
      </div>
    </section>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="pt-10 text-muted">Loading…</p>}>
      <MandatePage />
    </Suspense>
  );
}
