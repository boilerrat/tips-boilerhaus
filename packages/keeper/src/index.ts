/**
 * Subscription renewal keeper — entry point.
 *
 * Runs a periodic sweep over all SubscriptionManager subscriptions and
 * calls processRenewal() for any that are due. Designed to be deployed
 * as a Docker service alongside the web app, or run as a cron job.
 *
 * Environment variables:
 *   KEEPER_PRIVATE_KEY              — 0x-prefixed hex private key
 *   KEEPER_RPC_URL                  — RPC endpoint (Base or Base Sepolia)
 *   SUBSCRIPTION_MANAGER_ADDRESS    — SubscriptionManager contract address
 *   KEEPER_INTERVAL_MS              — sweep interval in ms (default: 60000)
 *   KEEPER_CHAIN_ID                 — chain ID (default: 84532)
 *
 * Usage:
 *   pnpm --filter @tips/keeper start
 *
 * Or with Docker (see infra/docker/Dockerfile.keeper).
 */

import { loadConfig } from './config.js'
import { createKeeper } from './keeper.js'

async function main() {
  const config = loadConfig()
  const keeper = createKeeper(config)

  console.log(`[keeper] Starting subscription renewal keeper`)
  console.log(`[keeper] Chain: ${config.chainId}`)
  console.log(`[keeper] Contract: ${config.subscriptionManagerAddress}`)
  console.log(`[keeper] Interval: ${config.intervalMs}ms`)

  // Run the first sweep immediately
  await keeper.sweep()

  // Then run on interval
  setInterval(async () => {
    try {
      await keeper.sweep()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[keeper] Sweep error: ${message}`)
    }
  }, config.intervalMs)
}

main().catch((err) => {
  console.error('[keeper] Fatal error:', err)
  process.exit(1)
})
