# Chainwrit app

The product UI for [Chainwrit](https://github.com/chainwrit/core): connect a Solana wallet, create spending mandates for your AI agents, fund them, watch every payment (including the ones the program rejected), and revoke in one click.

**Live:** https://chainwrit-app.vercel.app

Runs on **devnet** with `dUSDC`, a test mint with no value. The program has not been audited.

## What it does

- **Dashboard**: every mandate owned by the connected wallet, with vault balance, caps and today's spend.
- **New mandate**: agent key (paste one, or generate it in the browser and download it), allowed merchants, per-payment cap, 24-hour cap, expiry and an initial deposit, in one transaction.
- **Mandate page**: live state, allowlist, activity read from the transactions that touched the mandate, deposit / withdraw / revoke for the owner, and a ready-to-paste MCP config for the agent.
- **Faucet**: 25 test dUSDC (and a little SOL for fees if the wallet has none) from a devnet-only wallet.

Wallets that implement the Wallet Standard (Phantom, Solflare, Backpack) are detected automatically. Transactions are signed in the wallet and sent through the app's own devnet RPC, so the wallet's selected network does not matter.

Built on [`@chainwrit/sdk`](https://www.npmjs.com/package/@chainwrit/sdk).

## Run locally

```bash
cp .env.example .env.local
yarn install
yarn dev
```

| Variable | Purpose |
| --- | --- |
| `RPC_URL` | Devnet RPC, used server-side only. The browser reaches it through `/api/rpc`, which allows a fixed list of methods |
| `FAUCET_SECRET_KEY` | Base58 secret of a devnet-only wallet holding test dUSDC and some SOL |
| `NEXT_PUBLIC_MINT` | The dUSDC mint |
| `NEXT_PUBLIC_DEMO_MERCHANT` | Merchant prefilled in the create form (the demo data API) |

Demo limitations: the faucet cooldown is in memory and per instance.

## License

Apache-2.0
