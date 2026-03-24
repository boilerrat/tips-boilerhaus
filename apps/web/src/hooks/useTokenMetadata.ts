/**
 * Hook to fetch ERC-20 token metadata (name, symbol, decimals) on-chain.
 *
 * Used for custom token support — user pastes any ERC-20 address and
 * the UI fetches its metadata via standard ERC-20 view functions.
 */

import { useReadContract } from 'wagmi'
import { type Address, erc20Abi } from 'viem'

export interface TokenMetadata {
  name: string
  symbol: string
  decimals: number
}

export interface UseTokenMetadataResult {
  /** Fetched token metadata, or undefined while loading / on error. */
  metadata: TokenMetadata | undefined
  /** True while any of the contract reads are in flight. */
  isLoading: boolean
  /** True if all three reads succeeded. */
  isSuccess: boolean
  /** First error encountered, if any. */
  error: Error | null
}

/**
 * Fetch ERC-20 token metadata for a given address.
 *
 * @param tokenAddress - The ERC-20 contract address to query.
 *   Pass undefined to disable the query.
 */
export function useTokenMetadata(
  tokenAddress: Address | undefined,
): UseTokenMetadataResult {
  const enabled = !!tokenAddress

  const {
    data: name,
    isLoading: isLoadingName,
    error: nameError,
  } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'name',
    query: { enabled },
  })

  const {
    data: symbol,
    isLoading: isLoadingSymbol,
    error: symbolError,
  } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'symbol',
    query: { enabled },
  })

  const {
    data: decimals,
    isLoading: isLoadingDecimals,
    error: decimalsError,
  } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'decimals',
    query: { enabled },
  })

  const isLoading = isLoadingName || isLoadingSymbol || isLoadingDecimals
  const isSuccess = !!name && !!symbol && decimals !== undefined
  const error = nameError ?? symbolError ?? decimalsError

  const metadata: TokenMetadata | undefined = isSuccess
    ? { name: name as string, symbol: symbol as string, decimals: Number(decimals) }
    : undefined

  return { metadata, isLoading, isSuccess, error: error as Error | null }
}
