// Hands out test dUSDC (and a little SOL for fees) from a devnet-only wallet,
// so anyone can try creating and funding a mandate.
import { NextRequest, NextResponse } from "next/server";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";

export const dynamic = "force-dynamic";

const DUSDC = 25_000_000n; // 25 dUSDC
const DECIMALS = 6;
const SOL_TOP_UP = 0.02 * LAMPORTS_PER_SOL;
const COOLDOWN_MS = 10 * 60_000;

// Demo limitation: in memory, per instance.
const lastByKey = new Map<string, number>();

function cooling(key: string) {
  const last = lastByKey.get(key) ?? 0;
  return Date.now() - last < COOLDOWN_MS;
}

export async function POST(req: NextRequest) {
  const secret = process.env.FAUCET_SECRET_KEY;
  const mintStr = process.env.NEXT_PUBLIC_MINT;
  if (!secret || !mintStr) return NextResponse.json({ error: "Faucet is not configured" }, { status: 503 });

  let to: PublicKey;
  try {
    to = new PublicKey((await req.json()).address);
  } catch {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (cooling(to.toBase58()) || cooling(ip)) {
    return NextResponse.json({ error: "Faucet used recently. Try again in 10 minutes." }, { status: 429 });
  }

  const conn = new Connection(process.env.RPC_URL ?? "https://api.devnet.solana.com", "confirmed");
  const faucet = Keypair.fromSecretKey(bs58.decode(secret));
  const mint = new PublicKey(mintStr);
  const from = getAssociatedTokenAddressSync(mint, faucet.publicKey);
  const ata = getAssociatedTokenAddressSync(mint, to);

  const tx = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(faucet.publicKey, ata, to, mint),
    createTransferCheckedInstruction(from, mint, ata, faucet.publicKey, DUSDC, DECIMALS),
  );
  const sol = await conn.getBalance(to);
  const toppedUp = sol < 0.01 * LAMPORTS_PER_SOL;
  if (toppedUp) tx.add(SystemProgram.transfer({ fromPubkey: faucet.publicKey, toPubkey: to, lamports: SOL_TOP_UP }));

  try {
    const signature = await sendAndConfirmTransaction(conn, tx, [faucet], { commitment: "confirmed" });
    lastByKey.set(to.toBase58(), Date.now());
    lastByKey.set(ip, Date.now());
    return NextResponse.json({ signature, dusdc: 25, sol: toppedUp ? SOL_TOP_UP / LAMPORTS_PER_SOL : 0 });
  } catch (err: any) {
    return NextResponse.json({ error: "The faucet could not send right now. It may be empty." }, { status: 502 });
  }
}
