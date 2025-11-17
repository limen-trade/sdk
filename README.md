# Limen SDK

TypeScript client for Limen's mainnet-only API surface. It bundles wallet/secret-key authentication helpers, token storage utilities, and payment helpers that speak the x402 Solana flow.

## Installation

```bash
pnpm add limen-sdk
# or npm install / yarn add if you prefer
```

The package publishes ESM output that works in modern browsers, Node 18+, and edge runtimes.

## Creating a client

```ts
import { LimenClient } from "limen-sdk"

const client = new LimenClient({
  // Defaults to https://api.limen.trade; override only if directed by Limen.
  baseUrl: "https://api.limen.trade",
})
```

You may also pass a custom `fetch` implementation, your own `TokenStore`, or a pre-configured `paymentClient`. If you omit them, the SDK falls back to global `fetch` and its built-in in-memory token store.

## Authenticating

### Wallet authentication (recommended)

```ts
import type { WalletMessageSigner } from "limen-sdk"

const wallet: WalletMessageSigner = {
  address: "<SOL_PUBKEY>",
  async signMessage(message) {
    // delegate to a wallet adapter such as Phantom or Backpack
  },
}

await client.authenticateWithWallet(wallet)
```

`authenticateWithWallet` requests an auth challenge, has the wallet sign it, and stores the returned JWT via the configured token store.

### Secret key authentication

This flow is useful for backend jobs or CLIs.

```ts
import bs58 from "bs58"

const secretKey = bs58.decode(process.env.LIMEN_SECRET_KEY!)
await client.authenticateWithSecretKey(secretKey)
```

Secret keys can be provided as `Keypair`, base58 strings, `Uint8Array`, or number arrays. The SDK normalizes the input and guards against invalid lengths.

## Requesting paid signals

Paid endpoints require an x402-enabled payment client. The SDK exposes helpers for both wallet adapters and raw `Keypair`s; both default to Solana mainnet and enforce a conservative max payment amount.

```ts
import {
  createWalletPaymentClient,
  createKeypairPaymentClient,
} from "limen-sdk"
import { Connection, Keypair } from "@solana/web3.js"

// For browser flows
client.setPaymentClient(
  createWalletPaymentClient({
    wallet: myWalletAdapter,
    maxPaymentAmount: BigInt(5_000_000), // optional override
  })
)

// For server-side flows
const keypair = Keypair.fromSecretKey(secretBytes)
const connection = new Connection("https://api.mainnet-beta.solana.com")
client.setPaymentClient(
  createKeypairPaymentClient({ keypair, connection })
)
```

Once a payment client is registered and a JWT is stored, you can request signals:

```ts
const signal = await client.requestSignal({
  ticker: "SOL",
  timeframe: "1d",
  metadata: { source: "internal-tool" },
})

console.log(signal.consensus.stance, signal.consensus.confidence)
```

The SDK automatically includes your JWT, manages 401 retries by clearing stale tokens, and surfaces payment errors (HTTP 402) if the x402 flow fails.

## Additional tips

- `client.getHistory({ limit: 20 })` returns recent analysis runs along with pagination metadata.
- Provide a persistent `TokenStore` (e.g., `localStorage`) if you need session continuity; the default store keeps tokens in memory only.
- The package exposes type definitions (see `src/types.ts`) to help you wire Limen data into your app.
- Run `pnpm build` inside `limen-sdk/` before publishing to ensure the emitted `dist/` artifacts are current.
