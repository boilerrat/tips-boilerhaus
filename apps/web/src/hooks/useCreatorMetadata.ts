/**
 * Hook to fetch and validate a creator's off-chain metadata from IPFS.
 *
 * Takes the metadataIpfsHash stored on-chain in the CreatorRegistry,
 * resolves it to an HTTP gateway URL, fetches the JSON, and validates
 * it against the CreatorMetadata schema.
 *
 * Uses TanStack Query for caching — metadata is immutable (content-addressed),
 * so staleTime is set to Infinity.
 */

import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import type { CreatorMetadata } from '@tips/shared'
import { ipfsToHttpUrl, isIpfsUri } from '@/lib/ipfs'

/**
 * Zod schema matching the CreatorMetadata interface in packages/shared.
 * Mirrors the validation in /api/ipfs/pin — must stay in sync.
 */
const creatorMetadataSchema = z.object({
  displayName: z.string().min(1).max(100),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().or(z.string().startsWith('ipfs://')).optional(),
  websiteUrl: z.string().url().optional(),
  farcasterHandle: z
    .string()
    .max(20)
    .regex(/^[a-zA-Z0-9_.-]+$/)
    .optional(),
})

/** Resolve an avatar URL — convert ipfs:// URIs to HTTP gateway URLs. */
function resolveAvatarUrl(avatarUrl: string): string {
  return isIpfsUri(avatarUrl) ? ipfsToHttpUrl(avatarUrl) : avatarUrl
}

/**
 * Fetch a CreatorMetadata JSON document from IPFS by its CID.
 * Throws on network errors, non-OK responses, or schema validation failures.
 */
async function fetchCreatorMetadata(ipfsHash: string): Promise<CreatorMetadata> {
  const url = ipfsToHttpUrl(ipfsHash)
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch metadata from IPFS (${response.status})`)
  }

  const json: unknown = await response.json()
  const parsed = creatorMetadataSchema.parse(json)

  // Build via conditional spreads — satisfies exactOptionalPropertyTypes
  // without mutation. Checks `!== undefined` (not truthiness) to preserve
  // empty strings as valid values.
  return {
    displayName: parsed.displayName,
    ...(parsed.bio !== undefined && { bio: parsed.bio }),
    ...(parsed.avatarUrl !== undefined && {
      avatarUrl: resolveAvatarUrl(parsed.avatarUrl),
    }),
    ...(parsed.websiteUrl !== undefined && { websiteUrl: parsed.websiteUrl }),
    ...(parsed.farcasterHandle !== undefined && {
      farcasterHandle: parsed.farcasterHandle,
    }),
  }
}

export interface UseCreatorMetadataResult {
  /** Parsed creator metadata, or undefined if not available / still loading. */
  metadata: CreatorMetadata | undefined
  /** Resolved avatar HTTP URL, or undefined if no avatar. */
  avatarUrl: string | undefined
  /** True while the IPFS fetch is in flight. */
  isLoading: boolean
  /** Error from fetch or validation, if any. */
  error: Error | null
}

/**
 * Resolve an IPFS metadata hash to a validated CreatorMetadata object.
 *
 * @param ipfsHash - The CIDv1 hash from CreatorRegistry.metadataIpfsHash.
 *                   Pass undefined to skip the fetch (e.g. unregistered creator).
 */
export function useCreatorMetadata(
  ipfsHash: string | undefined,
): UseCreatorMetadataResult {
  const { data, isLoading, error } = useQuery({
    queryKey: ['creator-metadata', ipfsHash],
    queryFn: () => fetchCreatorMetadata(ipfsHash!),
    enabled: !!ipfsHash,
    // IPFS content is immutable (content-addressed) — never refetch the same CID.
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 2,
  })

  return {
    metadata: data,
    avatarUrl: data?.avatarUrl,
    isLoading,
    error: error ?? null,
  }
}
