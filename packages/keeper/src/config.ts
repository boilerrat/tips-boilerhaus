/**
 * Keeper configuration — sourced from environment variables.
 *
 * Required env vars:
 *   KEEPER_PRIVATE_KEY — hex-encoded private key (with 0x prefix) for the keeper wallet
 *   KEEPER_RPC_URL — RPC endpoint for Base or Base Sepolia
 *   SUBSCRIPTION_MANAGER_ADDRESS — deployed SubscriptionManager contract address
 *
 * Optional:
 *   KEEPER_INTERVAL_MS — polling interval in ms (default: 60000 = 1 minute)
 *   KEEPER_CHAIN_ID — chain ID (default: 84532 = Base Sepolia)
 */

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

export interface KeeperConfig {
  readonly privateKey: `0x${string}`
  readonly rpcUrl: string
  readonly subscriptionManagerAddress: `0x${string}`
  readonly intervalMs: number
  readonly chainId: number
}

export function loadConfig(): KeeperConfig {
  const privateKey = requireEnv('KEEPER_PRIVATE_KEY') as `0x${string}`
  const rpcUrl = requireEnv('KEEPER_RPC_URL')
  const subscriptionManagerAddress = requireEnv('SUBSCRIPTION_MANAGER_ADDRESS') as `0x${string}`
  const intervalMs = parseInt(process.env['KEEPER_INTERVAL_MS'] ?? '60000', 10)
  const chainId = parseInt(process.env['KEEPER_CHAIN_ID'] ?? '84532', 10)

  if (!privateKey.startsWith('0x') || privateKey.length !== 66) {
    throw new Error('KEEPER_PRIVATE_KEY must be a 0x-prefixed 32-byte hex string')
  }
  if (!subscriptionManagerAddress.startsWith('0x') || subscriptionManagerAddress.length !== 42) {
    throw new Error('SUBSCRIPTION_MANAGER_ADDRESS must be a valid 0x address')
  }

  return { privateKey, rpcUrl, subscriptionManagerAddress, intervalMs, chainId }
}
