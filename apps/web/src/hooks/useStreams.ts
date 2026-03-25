/**
 * Hooks for querying Superfluid stream data via the Superfluid subgraph.
 *
 * Used by the creator dashboard to show incoming streams and aggregate
 * flow rates, and by the stream form to check for existing streams.
 */

'use client'

import { useQuery } from '@tanstack/react-query'
import { useChainId } from 'wagmi'
import { SUPERFLUID_SUBGRAPH } from '@/lib/superfluid'

/** A stream record from the Superfluid subgraph. */
export interface SubgraphStream {
  id: string
  sender: { id: `0x${string}` }
  receiver: { id: `0x${string}` }
  /** Per-second flow rate as a decimal string. */
  currentFlowRate: string
  /** Total streamed (in wei) at the time of last update. */
  streamedUntilUpdatedAt: string
  /** Unix timestamp of last update. */
  updatedAtTimestamp: string
  /** Unix timestamp of stream creation. */
  createdAtTimestamp: string
  token: {
    id: `0x${string}`
    symbol: string
    name: string
    decimals: number
  }
}

const ACTIVE_INCOMING_STREAMS_QUERY = `
  query ActiveIncomingStreams($receiver: String!) {
    streams(
      where: { receiver: $receiver, currentFlowRate_gt: "0" }
      orderBy: createdAtTimestamp
      orderDirection: desc
      first: 100
    ) {
      id
      sender { id }
      receiver { id }
      currentFlowRate
      streamedUntilUpdatedAt
      updatedAtTimestamp
      createdAtTimestamp
      token { id symbol name decimals }
    }
  }
`

const ACTIVE_OUTGOING_STREAMS_QUERY = `
  query ActiveOutgoingStreams($sender: String!) {
    streams(
      where: { sender: $sender, currentFlowRate_gt: "0" }
      orderBy: createdAtTimestamp
      orderDirection: desc
      first: 100
    ) {
      id
      sender { id }
      receiver { id }
      currentFlowRate
      streamedUntilUpdatedAt
      updatedAtTimestamp
      createdAtTimestamp
      token { id symbol name decimals }
    }
  }
`

async function querySubgraph(
  chainId: number,
  query: string,
  variables: Record<string, string>,
): Promise<SubgraphStream[]> {
  const url = SUPERFLUID_SUBGRAPH[chainId]
  if (!url) return []

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })

  if (!res.ok) throw new Error(`Subgraph query failed: ${res.status}`)

  const json = await res.json()
  return json.data?.streams ?? []
}

/**
 * Fetch all active incoming streams for an address.
 * Used by the creator dashboard.
 */
export function useIncomingStreams(receiver: `0x${string}` | undefined) {
  const chainId = useChainId()

  const { data: streams = [], isLoading, error, refetch } = useQuery({
    queryKey: ['superfluid-streams', 'incoming', chainId, receiver],
    queryFn: () =>
      querySubgraph(chainId, ACTIVE_INCOMING_STREAMS_QUERY, {
        receiver: receiver!.toLowerCase(),
      }),
    enabled: !!receiver && !!SUPERFLUID_SUBGRAPH[chainId],
    refetchInterval: 30_000,
    staleTime: 10_000,
  })

  // Compute aggregate flow rate (sum of all incoming streams, in wei/sec)
  const aggregateFlowRate = streams.reduce(
    (acc, s) => acc + BigInt(s.currentFlowRate),
    0n,
  )

  return { streams, aggregateFlowRate, isLoading, error, refetch }
}

/**
 * Fetch all active outgoing streams for an address.
 * Used by the sender's stream management view.
 */
export function useOutgoingStreams(sender: `0x${string}` | undefined) {
  const chainId = useChainId()

  const { data: streams = [], isLoading, error, refetch } = useQuery({
    queryKey: ['superfluid-streams', 'outgoing', chainId, sender],
    queryFn: () =>
      querySubgraph(chainId, ACTIVE_OUTGOING_STREAMS_QUERY, {
        sender: sender!.toLowerCase(),
      }),
    enabled: !!sender && !!SUPERFLUID_SUBGRAPH[chainId],
    refetchInterval: 30_000,
    staleTime: 10_000,
  })

  return { streams, isLoading, error, refetch }
}
