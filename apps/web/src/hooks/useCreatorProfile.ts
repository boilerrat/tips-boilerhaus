/**
 * Hook to fetch a creator's on-chain profile from the CreatorRegistry contract.
 *
 * Returns the profile data mapped to the shared CreatorProfile type.
 * Gracefully handles unregistered addresses — returns { registered: false }
 * so the UI can still show a raw-address tip form.
 */

import { useReadContract } from 'wagmi'
import { type Address, zeroAddress } from 'viem'
import { creatorRegistryAbi, REGISTRY_ADDRESS } from '@/lib/contracts'
import type { CreatorProfile, PaymentMode, PaymentTier } from '@tips/shared'

/** Contract PaymentMode enum values mapped to shared types. */
const PAYMENT_MODE_MAP: Record<number, PaymentMode> = {
  0: 'tip',
  1: 'subscription',
  2: 'stream',
}

export interface UseCreatorProfileResult {
  /** The creator profile, or undefined if not registered / still loading. */
  profile: CreatorProfile | undefined
  /** Whether this address is registered in the contract. */
  isRegistered: boolean
  /** True while the contract read is in flight. */
  isLoading: boolean
  /** Error from the contract call, if any. */
  error: Error | null
  /** Whether the registry contract address is configured. */
  registryConfigured: boolean
}

/**
 * Read a creator's profile from the on-chain registry.
 *
 * @param address - The creator's wallet address to look up.
 */
export function useCreatorProfile(address: Address | undefined): UseCreatorProfileResult {
  const registryConfigured = !!REGISTRY_ADDRESS

  const {
    data,
    isLoading,
    error,
  } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: creatorRegistryAbi,
    functionName: 'getCreator',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && registryConfigured,
    },
  })

  // The contract returns a Creator struct — creatorAddress is zero if not registered
  const isRegistered = !!data && data.creatorAddress !== zeroAddress

  const profile: CreatorProfile | undefined = isRegistered && data
    ? {
        address: data.creatorAddress as Address,
        metadataIpfsHash: data.metadataIpfsHash || undefined,
        tiers: data.tiers.map((tier): PaymentTier => ({
          label: tier.label,
          amountWei: tier.amountWei,
          tokenAddress: tier.tokenAddress === zeroAddress
            ? undefined
            : (tier.tokenAddress as Address),
          mode: PAYMENT_MODE_MAP[tier.mode] ?? 'tip',
        })),
        active: data.active,
      }
    : undefined

  return {
    profile,
    isRegistered,
    isLoading,
    error: error ?? null,
    registryConfigured,
  }
}
