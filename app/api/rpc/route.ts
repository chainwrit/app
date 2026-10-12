// Forwards JSON-RPC from the browser to the configured devnet RPC, so a keyed
// endpoint never ships to the client. Only the methods the app uses pass.
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ALLOWED = new Set([
  "getAccountInfo",
  "getBalance",
  "getBlockHeight",
  "getFeeForMessage",
  "getGenesisHash",
  "getLatestBlockhash",
  "getMinimumBalanceForRentExemption",
  "getMultipleAccounts",
  "getProgramAccounts",
  "getSignatureStatuses",
  "getSignaturesForAddress",
  "getSlot",
  "getTokenAccountBalance",
  "getTokenAccountsByOwner",
  "getTransaction",
  "getVersion",
  "isBlockhashValid",
  "sendTransaction",
  "simulateTransaction",
]);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const calls = Array.isArray(body) ? body : [body];
  if (!body || calls.length > 50 || calls.some((c) => !c || !ALLOWED.has(c.method))) {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32601, message: "Method not allowed" } }, { status: 400 });
  }

  const upstream = await fetch(process.env.RPC_URL ?? "https://api.devnet.solana.com", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: { "content-type": "application/json" },
  });
}
