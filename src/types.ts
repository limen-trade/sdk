import type {
  Keypair,
  Connection,
  SendOptions,
  VersionedTransaction,
} from "@solana/web3.js"

export type FetchLike = (url: string, init?: RequestLike) => Promise<ResponseLike>

export type RequestLike = {
  method?: string
  headers?: Record<string, string>
  body?: string
}

export interface ResponseLike {
  status: number
  ok?: boolean
  headers?: {
    get(name: string): string | null
  }
  json(): Promise<any>
  text(): Promise<string>
}

export interface TokenStore {
  getToken(): Promise<string | null> | string | null
  setToken(token: string): Promise<void> | void
  clearToken(): Promise<void> | void
}

export interface WalletMessageSigner {
  address: string
  signMessage(message: Uint8Array): Promise<Uint8Array>
}

export interface WalletPaymentAdapter {
  address: string
  signTransaction(transaction: VersionedTransaction): Promise<VersionedTransaction>
  sendTransaction(
    transaction: VersionedTransaction,
    connection: Connection,
    options?: SendOptions
  ): Promise<string>
}

export interface PaymentClient {
  fetch: FetchLike
}

export type SecretKeyInput = string | Uint8Array | number[] | Keypair

export interface HistoryEntry {
  id: string
  wallet: string
  ticker: string
  timeframe: string
  consensus: Record<string, unknown>
  created_at: string
}

export interface HistoryPagination {
  limit: number | null
  page: number
  pageSize: number
  total: number
  hasMore: boolean
}

export interface HistoryListResponse {
  history: HistoryEntry[]
  pagination: HistoryPagination | null
}

export type HistoryQueryOptions = {
  page?: number
  limit?: number | "all"
  all?: boolean
}

export interface SignalRequestOptions {
  ticker: string
  timeframe?: string
  metadata?: Record<string, unknown>
}

export interface SignalResponse {
  success: boolean
  consensus: {
    stance?: string
    confidence?: number
    rationale?: string
    breakdown?: Array<Record<string, unknown>>
    [key: string]: unknown
  }
  [key: string]: unknown
}
