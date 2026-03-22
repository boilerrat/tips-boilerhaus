/**
 * Core domain types for the tips protocol.
 * Shared between apps/web and packages/contracts.
 *
 * Keep this file free of framework dependencies — plain TypeScript only.
 */

/** The three supported payment modes. */
export type PaymentMode = 'tip' | 'subscription' | 'stream'

/**
 * A one-time tip — simplest mode.
 * ETH or ERC-20 transferred directly from sender to recipient.
 */
export interface TipPayment {
  mode: 'tip'
  recipientAddress: `0x${string}`
  amountWei: bigint
  tokenAddress?: `0x${string}` // undefined = native ETH
  message?: string // optional on-chain or off-chain message
}

/**
 * A recurring subscription — periodic pull or Sablier lockup.
 * Sender pre-approves a token allowance; creator claims on schedule.
 */
export interface SubscriptionPayment {
  mode: 'subscription'
  recipientAddress: `0x${string}`
  amountWeiPerPeriod: bigint
  periodSeconds: number // e.g. 2592000 = 30 days
  tokenAddress: `0x${string}` // ERC-20 required for subscriptions
  startTimestamp?: number // defaults to now
}

/**
 * A real-time stream via Superfluid CFA.
 * Tokens flow per second until the stream is cancelled.
 */
export interface StreamPayment {
  mode: 'stream'
  recipientAddress: `0x${string}`
  flowRatePerSecond: bigint // in Super Token atomic units
  superTokenAddress: `0x${string}` // must be a registered Superfluid Super Token
}

export type Payment = TipPayment | SubscriptionPayment | StreamPayment

/**
 * A creator profile stored in the registry contract.
 * Metadata hash points to IPFS JSON with display name, bio, avatar.
 */
export interface CreatorProfile {
  address: `0x${string}`
  ensName?: string
  metadataIpfsHash?: string // CIDv1
  tiers: PaymentTier[]
  active: boolean
}

/** A suggested payment tier — amounts are in the token's atomic units. */
export interface PaymentTier {
  label: string // e.g. "Coffee", "Supporter", "Patron"
  amountWei: bigint
  tokenAddress?: `0x${string}` // undefined = native ETH
  mode: PaymentMode
}
