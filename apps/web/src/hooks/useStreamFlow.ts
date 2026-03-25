/**
 * Hook for managing Superfluid CFA streams via the CFAv1Forwarder.
 *
 * Uses `setFlowrate` — a single function that handles create, update,
 * and delete (pass 0n to stop a stream). This is the simplest Superfluid API.
 *
 * Also exposes `getFlowrate` to check if a stream already exists between
 * sender and receiver for a given Super Token.
 */

'use client'

import { useCallback } from 'react'
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useAccount,
  useChainId,
} from 'wagmi'
import { cfaForwarderAbi, cfaForwarderAddress } from '@sfpro/sdk/abi'

interface UseStreamFlowResult {
  /** Set a flow rate (creates, updates, or deletes a stream). Pass 0n to stop. */
  setFlowrate: (superToken: `0x${string}`, receiver: `0x${string}`, flowRate: bigint) => void
  /** Transaction hash, if submitted. */
  txHash: `0x${string}` | undefined
  /** Whether the wallet prompt is open. */
  isPending: boolean
  /** Whether we're waiting for on-chain confirmation. */
  isConfirming: boolean
  /** Whether the transaction confirmed successfully. */
  isConfirmed: boolean
  /** Error from the transaction. */
  error: Error | null
  /** Reset state for another transaction. */
  reset: () => void
}

export function useStreamFlow(): UseStreamFlowResult {
  const { address: sender } = useAccount()
  const chainId = useChainId()

  const {
    writeContract,
    data: txHash,
    isPending,
    error: writeError,
    reset,
  } = useWriteContract()

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash: txHash,
    confirmations: 1,
    query: { enabled: !!txHash, retry: 10, retryDelay: 2_000 },
  })

  const setFlowrate = useCallback(
    (superToken: `0x${string}`, receiver: `0x${string}`, flowRate: bigint) => {
      if (!sender) return

      // cfaForwarderAddress is a chain-indexed object from the SDK
      const forwarderAddr = cfaForwarderAddress[chainId as keyof typeof cfaForwarderAddress]
      if (!forwarderAddr) return

      writeContract({
        address: forwarderAddr,
        abi: cfaForwarderAbi,
        functionName: 'setFlowrate',
        args: [superToken, receiver, flowRate],
      })
    },
    [sender, chainId, writeContract],
  )

  return {
    setFlowrate,
    txHash,
    isPending,
    isConfirming,
    isConfirmed,
    error: writeError ?? receiptError ?? null,
    reset,
  }
}

/**
 * Read the current flow rate between sender and receiver for a Super Token.
 * Returns 0n if no stream exists.
 */
export function useExistingFlowRate(
  superToken: `0x${string}` | undefined,
  receiver: `0x${string}` | undefined,
) {
  const { address: sender } = useAccount()
  const chainId = useChainId()
  const forwarderAddr = cfaForwarderAddress[chainId as keyof typeof cfaForwarderAddress]

  const { data: flowRate, refetch } = useReadContract({
    address: forwarderAddr,
    abi: cfaForwarderAbi,
    functionName: 'getFlowrate',
    args: [superToken!, sender!, receiver!],
    query: { enabled: !!superToken && !!sender && !!receiver && !!forwarderAddr },
  })

  return {
    flowRate: (flowRate as bigint | undefined) ?? 0n,
    hasExistingStream: !!flowRate && flowRate > 0n,
    refetch,
  }
}
