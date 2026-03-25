/**
 * Subscription renewal keeper logic.
 *
 * Iterates all subscriptions on the SubscriptionManager contract. For each
 * active subscription whose renewal period has elapsed, calls processRenewal().
 *
 * Designed to be run as a cron job or long-running service. Failures on
 * individual renewals (e.g. subscriber has insufficient balance/allowance)
 * are logged and skipped — the keeper continues to the next subscription.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
  type Transport,
  type Chain,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base, baseSepolia } from 'viem/chains'
import { subscriptionManagerAbi } from './abi.js'
import type { KeeperConfig } from './config.js'

interface Subscription {
  readonly id: bigint
  readonly subscriber: `0x${string}`
  readonly creator: `0x${string}`
  readonly token: `0x${string}`
  readonly amountPerPeriod: bigint
  readonly periodSeconds: bigint
  readonly startTimestamp: bigint
  readonly lastPaidTimestamp: bigint
  readonly active: boolean
  readonly pendingAmount: bigint
  readonly pendingPeriod: bigint
}

const CHAINS: Record<number, Chain> = {
  8453: base,
  84532: baseSepolia,
}

export function createKeeper(config: KeeperConfig) {
  const chain = CHAINS[config.chainId]
  if (!chain) {
    throw new Error(`Unsupported chain ID: ${config.chainId}`)
  }

  const transport = http(config.rpcUrl)
  const account = privateKeyToAccount(config.privateKey)

  const publicClient: PublicClient<Transport, Chain> = createPublicClient({
    chain,
    transport,
  })

  const walletClient: WalletClient = createWalletClient({
    account,
    chain,
    transport,
  })

  /**
   * Run a single sweep: check all subscriptions and process any due renewals.
   * Returns the number of renewals successfully processed.
   */
  async function sweep(): Promise<number> {
    const nextId = await publicClient.readContract({
      address: config.subscriptionManagerAddress,
      abi: subscriptionManagerAbi,
      functionName: 'nextSubscriptionId',
    })

    if (nextId === 0n) {
      log('No subscriptions exist yet')
      return 0
    }

    const now = BigInt(Math.floor(Date.now() / 1000))
    let renewedCount = 0

    log(`Checking ${nextId} subscription(s)...`)

    for (let id = 0n; id < nextId; id++) {
      try {
        const sub = await publicClient.readContract({
          address: config.subscriptionManagerAddress,
          abi: subscriptionManagerAbi,
          functionName: 'getSubscription',
          args: [id],
        }) as Subscription

        if (!sub.active) continue

        const nextRenewal = sub.lastPaidTimestamp + sub.periodSeconds
        if (now < nextRenewal) continue

        // Renewal is due — attempt to process it
        log(`Sub #${id}: renewal due (${sub.subscriber} -> ${sub.creator}). Processing...`)

        try {
          const hash = await walletClient.writeContract({
            address: config.subscriptionManagerAddress,
            abi: subscriptionManagerAbi,
            functionName: 'processRenewal',
            args: [id],
          })

          log(`Sub #${id}: tx sent ${hash}. Waiting for confirmation...`)

          const receipt = await publicClient.waitForTransactionReceipt({
            hash,
            confirmations: 1,
          })

          if (receipt.status === 'success') {
            log(`Sub #${id}: renewed successfully (block ${receipt.blockNumber})`)
            renewedCount++
          } else {
            log(`Sub #${id}: tx reverted (block ${receipt.blockNumber})`)
          }
        } catch (err) {
          // Common case: subscriber has insufficient balance or revoked allowance.
          // Log and continue — don't let one failure stop the entire sweep.
          const message = err instanceof Error ? err.message : String(err)
          log(`Sub #${id}: renewal failed — ${message.slice(0, 200)}`)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        log(`Sub #${id}: read failed — ${message.slice(0, 200)}`)
      }
    }

    log(`Sweep complete. ${renewedCount} renewal(s) processed.`)
    return renewedCount
  }

  return { sweep }
}

function log(message: string): void {
  const ts = new Date().toISOString()
  console.log(`[keeper ${ts}] ${message}`)
}
