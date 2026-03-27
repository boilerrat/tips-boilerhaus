/**
 * Subscription renewal keeper — entry point.
 *
 * Runs a periodic sweep over all SubscriptionManager subscriptions and
 * calls processRenewal() for any that are due. Designed to be deployed
 * as a Docker service alongside the web app, or run as a cron job.
 *
 * Exposes an HTTP health endpoint on KEEPER_HEALTH_PORT (default: 8080)
 * for Docker health checks and external monitoring.
 *
 * Environment variables:
 *   KEEPER_PRIVATE_KEY              — 0x-prefixed hex private key
 *   KEEPER_RPC_URL                  — RPC endpoint (Base or Base Sepolia)
 *   SUBSCRIPTION_MANAGER_ADDRESS    — SubscriptionManager contract address
 *   KEEPER_INTERVAL_MS              — sweep interval in ms (default: 60000)
 *   KEEPER_CHAIN_ID                 — chain ID (default: 84532)
 *   KEEPER_HEALTH_PORT              — health endpoint port (default: 8080)
 *
 * Usage:
 *   pnpm --filter @tips/keeper start
 *
 * Or with Docker (see infra/docker/Dockerfile.keeper).
 */

import { loadConfig } from './config.js'
import { createKeeper } from './keeper.js'
import { recordSuccess, recordFailure, startHealthServer } from './health.js'

async function main() {
  const config = loadConfig()
  const keeper = createKeeper(config)

  const healthPort = Number(process.env.KEEPER_HEALTH_PORT ?? '8080')

  console.log(`[keeper] Starting subscription renewal keeper`)
  console.log(`[keeper] Chain: ${config.chainId}`)
  console.log(`[keeper] Contract: ${config.subscriptionManagerAddress}`)
  console.log(`[keeper] Interval: ${config.intervalMs}ms`)

  // Start health endpoint for monitoring
  startHealthServer(healthPort, config.intervalMs)

  // Run the first sweep immediately
  try {
    const renewals = await keeper.sweep()
    recordSuccess(renewals)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[keeper] Initial sweep error: ${message}`)
    recordFailure(message)
  }

  // Then run on interval
  setInterval(async () => {
    try {
      const renewals = await keeper.sweep()
      recordSuccess(renewals)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[keeper] Sweep error: ${message}`)
      recordFailure(message)
    }
  }, config.intervalMs)
}

main().catch((err) => {
  console.error('[keeper] Fatal error:', err)
  process.exit(1)
})
