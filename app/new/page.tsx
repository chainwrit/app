"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Keypair, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { buildCreateMandate, mandatePda } from "@chainwrit/sdk";
import { DEMO_MERCHANT, MINT, SYMBOL, TxError, explorerTx, parseAmount, sendAndConfirm } from "@/lib/chain";

const input =
  "w-full rounded-md border border-line bg-bg px-3 py-2 text-sm outline-none placeholder:text-muted/60 focus:border-accent";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

function download(name: string, data: string) {
  const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

export default function NewMandate() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  const router = useRouter();

  const [agent, setAgent] = useState("");
  const [generated, setGenerated] = useState<Keypair | null>(null);
  const [savedKey, setSavedKey] = useState(false);
  const [merchants, setMerchants] = useState(DEMO_MERCHANT);
  const [perPayment, setPerPayment] = useState("1");
  const [daily, setDaily] = useState("5");
  const [days, setDays] = useState("14");
  const [deposit, setDeposit] = useState("10");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; sig?: string } | null>(null);

  function generate() {
    const kp = Keypair.generate();
    setGenerated(kp);
    setSavedKey(false);
    setAgent(kp.publicKey.toBase58());
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!wallet.publicKey) return setVisible(true);

    try {
      let agentKey: PublicKey;
      try {
        agentKey = new PublicKey(agent.trim());
      } catch {
        throw new Error("Agent must be a valid Solana address");
      }
      const merchantKeys = merchants
        .split(/[\s,]+/)
        .filter(Boolean)
        .map((m) => {
          try {
            return new PublicKey(m);
          } catch {
            throw new Error(`Not a valid merchant address: ${m}`);
          }
        });
      if (!merchantKeys.length) throw new Error("Allow at least one merchant");
      if (merchantKeys.length > 10) throw new Error("A mandate can allow at most 10 merchants");

      const max = parseAmount(perPayment);
      const limit = parseAmount(daily);
      if (limit < max) throw new Error("The daily cap must be at least the per-payment cap");
      const expiryDays = Number(days);
      if (!(expiryDays > 0 && expiryDays <= 365)) throw new Error("Expiry must be between 1 and 365 days");
      const dep = deposit.trim() && Number(deposit) > 0 ? parseAmount(deposit) : 0n;

      if (await connection.getAccountInfo(mandatePda(wallet.publicKey, agentKey))) {
        throw new Error("You already have a mandate for this agent. Use a different agent key.");
      }
      if (dep > 0n) {
        const bal = await connection
          .getTokenAccountBalance(getAssociatedTokenAddressSync(MINT, wallet.publicKey))
          .then((b) => BigInt(b.value.amount))
          .catch(() => 0n);
        if (bal < dep) throw new Error(`Not enough ${SYMBOL} to deposit. Use the faucet on the dashboard first.`);
      }

      setBusy(true);
      const { instructions, mandate } = await buildCreateMandate(connection, wallet.publicKey, {
        agent: agentKey,
        mint: MINT,
        maxPerPayment: max,
        dailyLimit: limit,
        expiresAt: Math.floor(Date.now() / 1000) + Math.round(expiryDays * 86_400),
        merchants: merchantKeys,
        deposit: dep,
      });
      await sendAndConfirm(connection, wallet, instructions);
      router.push(`/m/${mandate.toBase58()}?created=1`);
    } catch (err: any) {
      setError({ text: err.message, sig: err instanceof TxError ? err.signature : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="max-w-2xl pt-6">
      <Link href="/" className="text-sm text-muted hover:text-fg">← Mandates</Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">New mandate</h1>
      <p className="mt-1 text-sm text-muted">
        Everything here is enforced by the Chainwrit program on devnet. The token is {SYMBOL}, a test mint with no value.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-6">
        <Field label="Agent key" hint="The public key your agent signs with. It can request payments and nothing else.">
          <div className="flex gap-2">
            <input className={`${input} addr`} value={agent} onChange={(e) => { setAgent(e.target.value); setGenerated(null); }} placeholder="Agent public key" />
            <button type="button" onClick={generate} className="shrink-0 rounded-md border border-line px-3 text-sm hover:border-muted">
              Generate
            </button>
          </div>
        </Field>
        {generated && (
          <div className="rounded-lg border border-accent/50 bg-panel p-4 text-sm">
            <p>
              A new agent key was generated in your browser. Download it now: it is the file your agent (for example the
              Chainwrit MCP server) signs with. It is not stored anywhere else.
            </p>
            <button
              type="button"
              onClick={() => {
                download(`agent-${generated.publicKey.toBase58().slice(0, 6)}.json`, JSON.stringify(Array.from(generated.secretKey)));
                setSavedKey(true);
              }}
              className="mt-3 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-black"
            >
              {savedKey ? "Downloaded ✓" : "Download agent key"}
            </button>
            <p className="mt-2 text-xs text-muted">Devnet only. Never reuse this key for real funds.</p>
          </div>
        )}

        <Field label="Allowed merchants" hint="One wallet address per line, up to 10. The prefilled one is the demo data API.">
          <textarea className={`${input} addr h-24`} value={merchants} onChange={(e) => setMerchants(e.target.value)} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={`Per payment (${SYMBOL})`}>
            <input className={input} inputMode="decimal" value={perPayment} onChange={(e) => setPerPayment(e.target.value)} />
          </Field>
          <Field label={`Per 24h (${SYMBOL})`}>
            <input className={input} inputMode="decimal" value={daily} onChange={(e) => setDaily(e.target.value)} />
          </Field>
          <Field label="Expires in (days)">
            <input className={input} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
          </Field>
        </div>

        <Field label={`Initial deposit (${SYMBOL})`} hint="Optional. You can deposit or withdraw later.">
          <input className={input} inputMode="decimal" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
        </Field>

        {error && (
          <p className="rounded-lg border border-bad/40 p-3 text-sm text-bad">
            {error.text}{" "}
            {error.sig && <a href={explorerTx(error.sig)} target="_blank" rel="noreferrer" className="underline">View transaction</a>}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || (!!generated && !savedKey)}
          className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-black hover:opacity-90 disabled:opacity-50"
        >
          {!wallet.publicKey ? "Connect wallet" : busy ? "Confirm in your wallet…" : "Create mandate"}
        </button>
        {generated && !savedKey && <p className="text-xs text-muted">Download the agent key first.</p>}
      </form>
    </section>
  );
}
