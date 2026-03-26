/**
 * Hook to fetch TipReceived events for a given address from the CreatorRegistry.
 *
 * Strategy: Direct RPC `getLogs` via viem — sufficient for MVP volume.
 * Migrate to a subgraph (The Graph or Ponder) when event volume warrants it.
 *
 * Returns decoded events enriched with block timestamps and token metadata.
 */

import { useQuery } from '@tanstack/react-query'
import { type Address, formatUnits, zeroAddress } from 'viem'
import { usePublicClient, useChainId } from 'wagmi'
import { creatorRegistryAbi, REGISTRY_ADDRESS } from '@/lib/contracts'
import { getTokensForChain } from '@/lib/tokens'

/** A decoded TipReceived event with display-ready metadata. */
export interface TipEvent {
  /** Transaction hash containing this event. */
  txHash: `0x${string}`
  /** Block number the event was emitted in. */
  blockNumber: bigint
  /** Unix timestamp of the block (seconds). */
  timestamp: number
  /** Address that sent the tip. */
  sender: Address
  /** Address that received the tip. */
  recipient: Address
  /** Token address (zeroAddress = native ETH). */
  tokenAddress: Address
  /** Raw amount in wei / atomic units. */
  amountRaw: bigint
  /** Human-readable formatted amount. */
  amountFormatted: string
  /** Token symbol (e.g. "ETH", "USDC"). */
  tokenSymbol: string
  /** Token decimals. */
  tokenDecimals: number
  /** Optional message attached to the tip. */
  message: string
}

export interface UseTipHistoryResult {
  /** Decoded tip events, most recent first. */
  tips: readonly TipEvent[]
  /** True while the initial fetch is in flight. */
  isLoading: boolean
  /** Error from the RPC call, if any. */
  error: Error | null
  /** Re-fetch tip history (e.g. after sending a new tip). */
  refetch: () => void
}

/** How far back to scan for events (in blocks). ~7 days on Base at 2s blocks. */
const BLOCK_RANGE = BigInt(302_400)

/**
 * Maximum block range per getLogs request.
 * Infura and many RPC providers limit eth_getLogs to ~10k blocks on Base.
 * We chunk requests to stay within this limit.
 */
const MAX_CHUNK_SIZE = BigInt(9_999)

/**
 * Fetch tip history for a given address.
 *
 * @param address - The recipient address to fetch tips for.
 * @param direction - "received" fetches tips TO this address, "sent" fetches tips FROM.
 */
export function useTipHistory(
  address: Address | undefined,
  direction: 'received' | 'sent' = 'received',
): UseTipHistoryResult {
  const publicClient = usePublicClient()
  const chainId = useChainId()
  const tokens = getTokensForChain(chainId)

  const {
    data: tips = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['tipHistory', address, direction, chainId, REGISTRY_ADDRESS],
    queryFn: async (): Promise<TipEvent[]> => {
      if (!publicClient || !address || !REGISTRY_ADDRESS) return []

      const currentBlock = await publicClient.getBlockNumber()
      const fromBlock = currentBlock > BLOCK_RANGE ? currentBlock - BLOCK_RANGE : BigInt(0)

      // Chunk getLogs requests to stay within RPC provider limits
      const eventArgs = direction === 'received'
        ? { recipient: address }
        : { sender: address }

      const allLogs = []
      for (let start = fromBlock; start <= currentBlock; start += MAX_CHUNK_SIZE + BigInt(1)) {
        const end = start + MAX_CHUNK_SIZE > currentBlock ? currentBlock : start + MAX_CHUNK_SIZE
        const chunkLogs = await publicClient.getContractEvents({
          address: REGISTRY_ADDRESS,
          abi: creatorRegistryAbi,
          eventName: 'TipReceived',
          args: eventArgs,
          fromBlock: start,
          toBlock: end,
        })
        allLogs.push(...chunkLogs)
      }

      const logs = allLogs

      if (logs.length === 0) return []

      // Collect unique block numbers to batch-fetch timestamps
      const uniqueBlocks = [...new Set(logs.map((log) => log.blockNumber))]
      const blockTimestamps = new Map<bigint, number>()

      // Fetch blocks in parallel (capped to avoid excessive requests)
      const blockPromises = uniqueBlocks.map(async (blockNum) => {
        const block = await publicClient.getBlock({ blockNumber: blockNum })
        blockTimestamps.set(blockNum, Number(block.timestamp))
      })
      await Promise.all(blockPromises)

      // Build token lookup for display metadata
      const tokenLookup = new Map(
        tokens.map((t) => [(t.address ?? zeroAddress).toLowerCase(), t]),
      )

      return logs
        .map((log): TipEvent => {
          const { recipient, sender, token, amount, message } = log.args as {
            recipient: Address
            sender: Address
            token: Address
            amount: bigint
            message: string
          }

          const tokenAddr = token ?? zeroAddress
          const tokenConfig = tokenLookup.get(tokenAddr.toLowerCase())
          const decimals = tokenConfig?.decimals ?? 18
          const symbol = tokenConfig?.symbol ?? (tokenAddr === zeroAddress ? 'ETH' : '???')

          return {
            txHash: log.transactionHash!,
            blockNumber: log.blockNumber,
            timestamp: blockTimestamps.get(log.blockNumber) ?? 0,
            sender,
            recipient,
            tokenAddress: tokenAddr,
            amountRaw: amount,
            amountFormatted: formatUnits(amount, decimals),
            tokenSymbol: symbol,
            tokenDecimals: decimals,
            message,
          }
        })
        .sort((a, b) => Number(b.blockNumber - a.blockNumber))
    },
    enabled: !!address && !!publicClient && !!REGISTRY_ADDRESS,
    staleTime: 30_000, // 30s — tips arrive infrequently
    refetchInterval: 60_000, // Auto-refresh every 60s
  })

  return {
    tips,
    isLoading,
    error: error as Error | null,
    refetch,
  }
}
