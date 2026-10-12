import { Connection, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import { decodeError } from "@chainwrit/sdk";

export const MINT = new PublicKey(process.env.NEXT_PUBLIC_MINT ?? "FqLbwGWwNQ5PBYZhEbmfPMX9yw13easpRqtxh3CLY6T5");
export const DEMO_MERCHANT = process.env.NEXT_PUBLIC_DEMO_MERCHANT ?? "Aoy8Ufnrfm8ENuhrF7F3SfEfEmNa8S3xJgtf8TFh4RxD";
export const DECIMALS = 6;
export const SYMBOL = "dUSDC";

export const explorerTx = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
export const explorerAddr = (a: string) => `https://explorer.solana.com/address/${a}?cluster=devnet`;

export const fmt = (base: bigint | number | undefined) =>
  base === undefined ? "" : `${(Number(base) / 10 ** DECIMALS).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${SYMBOL}`;
export const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

export function parseAmount(input: string): bigint {
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Enter an amount greater than zero");
  return BigInt(Math.round(n * 10 ** DECIMALS));
}

export class TxError extends Error {
  constructor(message: string, public signature?: string) {
    super(message);
  }
}

/**
 * Sign with the connected wallet, send, then poll for confirmation. Polling
 * avoids a websocket, which the RPC proxy cannot carry.
 */
export async function sendAndConfirm(
  connection: Connection,
  wallet: WalletContextState,
  instructions: TransactionInstruction[],
): Promise<string> {
  if (!wallet.publicKey) throw new TxError("Connect a wallet first");
  const latest = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: wallet.publicKey, ...latest }).add(...instructions);

  let signature: string;
  try {
    // Sign in the wallet but send through our own devnet RPC, so it does not
    // matter which cluster the wallet itself is pointed at.
    if (wallet.signTransaction) {
      const signed = await wallet.signTransaction(tx);
      signature = await connection.sendRawTransaction(signed.serialize(), { preflightCommitment: "confirmed" });
    } else {
      signature = await wallet.sendTransaction(tx, connection, { preflightCommitment: "confirmed" });
    }
  } catch (err: any) {
    const decoded = decodeError(err?.error ?? err);
    throw new TxError(decoded.code !== null ? `${decoded.name}: ${decoded.message}` : err?.message ?? "Transaction was not sent");
  }

  for (let i = 0; i < 60; i++) {
    const { value } = await connection.getSignatureStatuses([signature]);
    const status = value[0];
    if (status?.err) {
      const decoded = decodeError(status.err);
      throw new TxError(`${decoded.name}: ${decoded.message}`, signature);
    }
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return signature;
    if ((await connection.getBlockHeight("confirmed")) > latest.lastValidBlockHeight) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new TxError("Transaction was not confirmed in time", signature);
}
