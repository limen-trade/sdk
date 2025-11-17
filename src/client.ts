import {
  authenticateWithSecretKey,
  authenticateWithWallet,
} from "./auth.js"
import { defaultTokenStore } from "./token-store.js"
import type {
  FetchLike,
  TokenStore,
  WalletMessageSigner,
  SecretKeyInput,
  PaymentClient,
  HistoryEntry,
  HistoryPagination,
  HistoryListResponse,
  HistoryQueryOptions,
  SignalRequestOptions,
  SignalResponse,
  ResponseLike,
} from "./types.js"

const defaultFetchFn: FetchLike | null =
  typeof fetch === "function" ? (fetch as unknown as FetchLike) : null

function assertFetch(fetchFn?: FetchLike): FetchLike {
  if (fetchFn) return fetchFn
  if (!defaultFetchFn) {
    throw new Error(
      "No fetch implementation available. Provide a custom fetch via the SDK constructor."
    )
  }
  return defaultFetchFn
}

async function parseJson<T>(res: ResponseLike): Promise<T> {
  try {
    return (await res.json()) as T
  } catch (err) {
    const body = await res.text()
    throw new Error(`Failed to parse JSON response: ${body}`)
  }
}

export type LimenClientConfig = {
  baseUrl?: string
  tokenStore?: TokenStore
  fetch?: FetchLike
  paymentClient?: PaymentClient
}

export class LimenClient {
  private readonly baseUrl: string
  private readonly tokenStore: TokenStore
  private readonly fetchFn: FetchLike
  private paymentClient?: PaymentClient

  constructor(config: LimenClientConfig = {}) {
    const { baseUrl = "https://api.limen.trade", tokenStore, fetch, paymentClient } = config
    this.baseUrl = baseUrl.replace(/\/$/, "")
    this.tokenStore = tokenStore ?? defaultTokenStore
    this.fetchFn = assertFetch(fetch)
    this.paymentClient = paymentClient
  }

  setPaymentClient(paymentClient: PaymentClient) {
    this.paymentClient = paymentClient
  }

  async getToken(): Promise<string | null> {
    return await this.tokenStore.getToken()
  }

  async setToken(token: string) {
    await this.tokenStore.setToken(token)
  }

  async clearToken() {
    await this.tokenStore.clearToken()
  }

  async authenticateWithWallet(wallet: WalletMessageSigner) {
    const { token } = await authenticateWithWallet({
      baseUrl: this.baseUrl,
      wallet,
      fetch: this.fetchFn,
    })
    await this.setToken(token)
    return token
  }

  async authenticateWithSecretKey(secretKey: SecretKeyInput) {
    const { token } = await authenticateWithSecretKey({
      baseUrl: this.baseUrl,
      secretKey,
      fetch: this.fetchFn,
    })
    await this.setToken(token)
    return token
  }

  private async requireToken(): Promise<string> {
    const token = await this.getToken()
    if (!token) {
      throw new Error("No JWT is stored. Authenticate before making API requests.")
    }
    return token
  }

  private async authorizedFetch(path: string, init: { method?: string; body?: string } = {}) {
    const token = await this.requireToken()
    const headers = {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    }

    const res = await this.fetchFn(`${this.baseUrl}${path}`, {
      method: init.method ?? "POST",
      headers,
      body: init.body,
    })

    if (res.status === 401) {
      await this.clearToken()
      throw new Error("Unauthorized: JWT expired or invalid. Re-authenticate and try again.")
    }

    if (res.status >= 400) {
      const bodyText = await res.text()
      throw new Error(`Request failed (${res.status}): ${bodyText}`)
    }

    return res
  }

  async getHistory(options: HistoryQueryOptions = {}): Promise<HistoryListResponse> {
    const params = new URLSearchParams()

    if (options.all) {
      params.set("all", "true")
    } else if (options.limit) {
      params.set("limit", options.limit === "all" ? "all" : String(options.limit))
    }

    if (options.page) {
      params.set("page", String(options.page))
    }

    const query = params.toString()
    const res = await this.authorizedFetch(`/api/history${query ? `?${query}` : ""}`)
    const data = await parseJson<{ history?: HistoryEntry[]; pagination?: HistoryPagination }>(res)

    return {
      history: Array.isArray(data.history) ? data.history : [],
      pagination: data.pagination ?? null,
    }
  }

  async requestSignal(options: SignalRequestOptions): Promise<SignalResponse> {
    if (!this.paymentClient) {
      throw new Error(
        "No payment client configured. Use setPaymentClient() with an x402-enabled fetch client."
      )
    }

    const token = await this.requireToken()
    const body = JSON.stringify({
      ticker: options.ticker,
      timeframe: options.timeframe ?? "1d",
      metadata: options.metadata,
    })

    const res = await this.paymentClient.fetch(`${this.baseUrl}/api/analyze/signal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body,
    })

    if (res.status === 401) {
      await this.clearToken()
      throw new Error("Unauthorized: JWT expired or invalid. Re-authenticate and try again.")
    }

    if (res.status === 402) {
      throw new Error(
        "Payment required. The provided payment client did not complete the x402 flow."
      )
    }

    if (res.status >= 400) {
      const bodyText = await res.text()
      throw new Error(`Signal request failed (${res.status}): ${bodyText}`)
    }

    return parseJson<SignalResponse>(res)
  }
}
