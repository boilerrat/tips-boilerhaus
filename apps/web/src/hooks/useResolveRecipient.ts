/**
 * Hook to resolve a recipient identifier (ENS name or raw address) into
 * a normalized address and optional display name.
 *
 * Handles both directions:
 *   - ENS → address  (e.g. "vitalik.eth" → 0xd8dA...)
 *   - address → ENS  (reverse lookup for display)
 *
 * Uses wagmi's useEnsAddress / useEnsName under the hood, resolved on
 * Ethereum mainnet (ENS lives on L1 even though we operate on Base).
 */

import { useEnsAddress, useEnsName } from 'wagmi'
import { isAddress, type Address } from 'viem'
import { normalize } from 'viem/ens'
import { mainnet } from 'viem/chains'

export interface ResolvedRecipient {
  /** The resolved 0x address. Undefined while loading or on failure. */
  address: Address | undefined
  /** ENS name for display (set if input was ENS, or reverse-resolved). */
  ensName: string | undefined
  /** True while any resolution is in flight. */
  isLoading: boolean
  /** Error from ENS resolution, if any. */
  error: Error | null
  /** True if the raw input was already a valid address. */
  isRawAddress: boolean
}

/**
 * Resolve a `/pay/[recipient]` route param into a usable address + display name.
 *
 * @param recipient - ENS name (e.g. "vitalik.eth") or hex address string
 */
export function useResolveRecipient(recipient: string): ResolvedRecipient {
  const isRawAddress = isAddress(recipient)

  // Normalize ENS name for forward resolution (only when input looks like ENS)
  const normalizedEns = !isRawAddress ? safeNormalize(recipient) : undefined

  // Forward: ENS → address
  const {
    data: resolvedAddress,
    isLoading: isLoadingAddress,
    error: addressError,
  } = useEnsAddress({
    name: normalizedEns,
    chainId: mainnet.id,
    query: { enabled: !!normalizedEns },
  })

  // Reverse: address → ENS display name
  const knownAddress = isRawAddress
    ? (recipient as Address)
    : resolvedAddress ?? undefined

  const {
    data: reverseName,
    isLoading: isLoadingName,
  } = useEnsName({
    address: knownAddress,
    chainId: mainnet.id,
    query: { enabled: !!knownAddress },
  })

  // If input was ENS, use that as display; otherwise use reverse lookup result
  const ensName = normalizedEns ?? reverseName ?? undefined

  return {
    address: knownAddress,
    ensName,
    isLoading: isLoadingAddress || isLoadingName,
    error: addressError ?? null,
    isRawAddress,
  }
}

/** Safely normalize an ENS name — returns undefined on invalid input. */
function safeNormalize(name: string): string | undefined {
  try {
    return normalize(name)
  } catch {
    return undefined
  }
}
