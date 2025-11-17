import bs58 from "bs58"
import nacl from "tweetnacl"
import { Keypair } from "@solana/web3.js"
import type {
  FetchLike,
  WalletMessageSigner,
  SecretKeyInput,
  ResponseLike,
} from "./types.js"

const defaultFetchFn: FetchLike | null =
  typeof fetch === "function" ? (fetch as unknown as FetchLike) : null

type ChallengeResponse = { challenge: string; challengeToken: string }

function assertFetch(fetchFn?: FetchLike): FetchLike {
  if (fetchFn) return fetchFn
  if (!defaultFetchFn) {
    throw new Error(
      "No fetch implementation available. Provide a custom fetch via the SDK constructor."
    )
  }
  return defaultFetchFn
}

async function fetchJson<T>(res: ResponseLike): Promise<T> {
  try {
    return (await res.json()) as T
  } catch (err) {
    const body = await res.text()
    throw new Error(`Failed to parse JSON response: ${body}`)
  }
}

async function fetchChallenge(baseUrl: string, fetchFn: FetchLike): Promise<ChallengeResponse> {
  const res = await fetchFn(`${baseUrl}/api/auth/challenge`, { method: "GET" })
  if (res.status >= 400) {
    const body = await res.text()
    throw new Error(`Challenge fetch failed (${res.status}): ${body}`)
  }
  return fetchJson<ChallengeResponse>(res)
}

async function exchangeSignatureForToken(
  baseUrl: string,
  wallet: string,
  signature: string,
  challengeToken: string,
  fetchFn: FetchLike
): Promise<string> {
  const res = await fetchFn(`${baseUrl}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet, signature, challengeToken }),
  })

  const body = await fetchJson<{ token?: string; error?: string }>(res)
  if (res.status >= 400 || !body.token) {
    const message = body.error || `Auth failed (${res.status})`
    throw new Error(message)
  }

  return body.token
}

export async function authenticateWithWallet(options: {
  baseUrl: string
  wallet: WalletMessageSigner
  fetch?: FetchLike
}) {
  const { baseUrl, wallet, fetch: fetchFn } = options
  const resolvedFetch = assertFetch(fetchFn)
  const { challenge, challengeToken } = await fetchChallenge(baseUrl, resolvedFetch)

  const signatureBytes = await wallet.signMessage(new TextEncoder().encode(challenge))
  const signature = bs58.encode(signatureBytes)

  const token = await exchangeSignatureForToken(
    baseUrl,
    wallet.address,
    signature,
    challengeToken,
    resolvedFetch
  )

  return { token, wallet: wallet.address }
}

function isKeypair(input: SecretKeyInput): input is Keypair {
  return input instanceof Keypair
}

function normalizeSecretKey(input: SecretKeyInput) {
  if (isKeypair(input)) {
    return {
      wallet: input.publicKey.toBase58(),
      secretKey: input.secretKey,
    }
  }

  let keyBytes: Uint8Array

  if (typeof input === "string") {
    keyBytes = bs58.decode(input)
  } else if (input instanceof Uint8Array) {
    keyBytes = input
  } else {
    keyBytes = Uint8Array.from(input)
  }

  if (keyBytes.length === 32) {
    const pair = nacl.sign.keyPair.fromSeed(keyBytes)
    return { wallet: bs58.encode(pair.publicKey), secretKey: pair.secretKey }
  }

  if (keyBytes.length === 64) {
    const pair = nacl.sign.keyPair.fromSecretKey(keyBytes)
    return { wallet: bs58.encode(pair.publicKey), secretKey: pair.secretKey }
  }

  throw new Error("Secret key must be 32-byte seed or 64-byte secret key.")
}

export async function authenticateWithSecretKey(options: {
  baseUrl: string
  secretKey: SecretKeyInput
  fetch?: FetchLike
}) {
  const { baseUrl, secretKey, fetch: fetchFn } = options
  const resolvedFetch = assertFetch(fetchFn)
  const { wallet, secretKey: normalizedSecret } = normalizeSecretKey(secretKey)
  const { challenge, challengeToken } = await fetchChallenge(baseUrl, resolvedFetch)

  const message = new TextEncoder().encode(challenge)
  const signature = bs58.encode(nacl.sign.detached(message, normalizedSecret))

  const token = await exchangeSignatureForToken(
    baseUrl,
    wallet,
    signature,
    challengeToken,
    resolvedFetch
  )

  return { token, wallet }
}
