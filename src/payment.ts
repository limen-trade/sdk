import { Connection, Keypair, PublicKey, SendOptions, Transaction, VersionedTransaction } from "@solana/web3.js"
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token"
import { createX402Client } from "x402-solana/client"
import type { PaymentClient, WalletPaymentAdapter } from "./types.js"

const NETWORK = "solana" as const

export type WalletPaymentClientOptions = {
  wallet: WalletPaymentAdapter
  maxPaymentAmount?: bigint
}

export function createWalletPaymentClient(options: WalletPaymentClientOptions): PaymentClient {
  const { wallet, maxPaymentAmount = BigInt(1_000_000) } = options
  return createX402Client({
    wallet,
    network: NETWORK,
    maxPaymentAmount,
  }) as PaymentClient
}

export type KeypairPaymentClientOptions = {
  keypair: Keypair
  connection: Connection
  maxPaymentAmount?: bigint
  sendOptions?: SendOptions
}

export function createKeypairPaymentClient(
  options: KeypairPaymentClientOptions
): PaymentClient {
  const { keypair, connection, maxPaymentAmount = BigInt(1_000_000), sendOptions } = options

  const ensureAssociatedTokenAccount = async (mintAddress: string) => {
    const mintPubkey = new PublicKey(mintAddress)
    const mintInfo = await connection.getAccountInfo(mintPubkey, "confirmed")
    if (!mintInfo) {
      throw new Error(`Token mint ${mintAddress} does not exist on ${NETWORK}`)
    }

    const programId = mintInfo.owner?.toBase58() === TOKEN_2022_PROGRAM_ID.toBase58()
      ? TOKEN_2022_PROGRAM_ID
      : TOKEN_PROGRAM_ID

    const owner = keypair.publicKey
    const ata = await getAssociatedTokenAddress(mintPubkey, owner, false, programId)
    const ataInfo = await connection.getAccountInfo(ata, "confirmed")
    if (ataInfo) {
      return
    }

    const ix = createAssociatedTokenAccountInstruction(owner, ata, owner, mintPubkey, programId)
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed")

    const createAtaTx = new Transaction().add(ix)
    createAtaTx.recentBlockhash = blockhash
    createAtaTx.feePayer = owner
    createAtaTx.sign(keypair)

    const signature = await connection.sendRawTransaction(createAtaTx.serialize(), sendOptions)
    await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed")
  }

  const signTransaction = async (transaction: VersionedTransaction) => {
    transaction.sign([keypair])
    return transaction
  }

  const wallet = {
    address: keypair.publicKey.toBase58(),
    signTransaction,
    sendTransaction: async (transaction: VersionedTransaction) => {
      const signed = await signTransaction(transaction)
      const raw = signed.serialize()
      return connection.sendRawTransaction(raw, sendOptions)
    },
  }

  const baseClient = createWalletPaymentClient({ wallet, maxPaymentAmount })

  return {
    fetch: async (input, init) => {
      try {
        return await baseClient.fetch(input, init)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const mintMatch = message.match(/Associated Token Account for ([1-9A-HJ-NP-Za-km-z]{32,44})/)
        if (mintMatch) {
          await ensureAssociatedTokenAccount(mintMatch[1])
          return baseClient.fetch(input, init)
        }
        throw err
      }
    },
  }
}
