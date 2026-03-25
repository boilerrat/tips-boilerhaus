/**
 * Hooks for managing SubscriptionManager interactions.
 *
 * - useSubscribe: create a new subscription (approve + subscribe)
 * - useSubscriptionCancel: cancel an active subscription
 * - useSubscriptionAllowance: check + approve ERC-20 allowance for SubMgr
 * - useExistingSubscription: find active sub from sender to a creator
 * - useCreatorSubscriptions: read incoming subscriptions for a creator
 * - useSubscriberSubscriptions: read all subscriptions for a subscriber
 *
 * All write hooks follow the multi-step state machine pattern
 * (idle → approving → confirming → success) established in TipForm/StreamForm.
 */

'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useAccount,
  usePublicClient,
} from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import { erc20Abi, maxUint256, zeroAddress } from 'viem'
import {
  subscriptionManagerAbi,
  SUBSCRIPTION_MANAGER_ADDRESS,
} from '@/lib/contracts'

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

/** On-chain subscription struct, mapped to TypeScript. */
export interface SubscriptionData {
  readonly id: bigint
  readonly subscriber: `0x${string}`
  readonly creator: `0x${string}`
  readonly token: `0x${string}`
  readonly amountPerPeriod: bigint
  readonly periodSeconds: bigint
  readonly startTimestamp: bigint
  readonly lastPaidTimestamp: bigint
  readonly active: boolean
  readonly pendingAmount: bigint
  readonly pendingPeriod: bigint
}

/** Derived subscription status based on on-chain state + current time. */
export type SubscriptionStatus = 'active' | 'overdue' | 'cancelled'

/** Compute the status of a subscription based on its on-chain data. */
export function getSubscriptionStatus(sub: SubscriptionData): SubscriptionStatus {
  if (!sub.active) return 'cancelled'
  const now = BigInt(Math.floor(Date.now() / 1000))
  const nextRenewal = sub.lastPaidTimestamp + sub.periodSeconds
  if (now >= nextRenewal) return 'overdue'
  return 'active'
}

// ----------------------------------------------------------------
// useSubscribe — create a new subscription
// ----------------------------------------------------------------

interface UseSubscribeResult {
  /** Trigger the subscribe transaction. Caller must have approved allowance first. */
  subscribe: (
    creator: `0x${string}`,
    token: `0x${string}`,
    amountPerPeriod: bigint,
    periodSeconds: bigint,
  ) => void
  txHash: `0x${string}` | undefined
  isPending: boolean
  isConfirming: boolean
  isConfirmed: boolean
  error: Error | null
  reset: () => void
}

export function useSubscribe(): UseSubscribeResult {
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

  const subscribe = useCallback(
    (
      creator: `0x${string}`,
      token: `0x${string}`,
      amountPerPeriod: bigint,
      periodSeconds: bigint,
    ) => {
      if (!SUBSCRIPTION_MANAGER_ADDRESS) return
      writeContract({
        address: SUBSCRIPTION_MANAGER_ADDRESS,
        abi: subscriptionManagerAbi,
        functionName: 'subscribe',
        args: [creator, token, amountPerPeriod, periodSeconds],
      })
    },
    [writeContract],
  )

  return {
    subscribe,
    txHash,
    isPending,
    isConfirming,
    isConfirmed,
    error: writeError ?? receiptError ?? null,
    reset,
  }
}

// ----------------------------------------------------------------
// useSubscriptionCancel — cancel an active subscription
// ----------------------------------------------------------------

interface UseSubscriptionCancelResult {
  cancel: (subscriptionId: bigint) => void
  txHash: `0x${string}` | undefined
  isPending: boolean
  isConfirming: boolean
  isConfirmed: boolean
  error: Error | null
  reset: () => void
}

export function useSubscriptionCancel(): UseSubscriptionCancelResult {
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

  const cancel = useCallback(
    (subscriptionId: bigint) => {
      if (!SUBSCRIPTION_MANAGER_ADDRESS) return
      writeContract({
        address: SUBSCRIPTION_MANAGER_ADDRESS,
        abi: subscriptionManagerAbi,
        functionName: 'cancel',
        args: [subscriptionId],
      })
    },
    [writeContract],
  )

  return {
    cancel,
    txHash,
    isPending,
    isConfirming,
    isConfirmed,
    error: writeError ?? receiptError ?? null,
    reset,
  }
}

// ----------------------------------------------------------------
// useSubscriptionAllowance — check + approve ERC-20 allowance for SubMgr
// ----------------------------------------------------------------

interface UseSubscriptionAllowanceResult {
  /** Current allowance the sender has approved for the SubscriptionManager. */
  allowance: bigint | undefined
  /** Whether allowance is still loading. */
  isLoading: boolean
  /** Whether more allowance is needed for the given amount. */
  needsApproval: boolean
  /** Send an approve(maxUint256) tx for the given token. */
  approve: () => void
  /** Whether the approve tx is awaiting wallet confirmation. */
  isApprovePending: boolean
  /** Whether we're waiting for on-chain approval confirmation. */
  isApproveConfirming: boolean
  /** Whether approval has been confirmed on-chain. */
  isApproveConfirmed: boolean
  approveError: Error | null
  resetApprove: () => void
  refetchAllowance: () => void
}

export function useSubscriptionAllowance(
  tokenAddress: `0x${string}` | undefined,
  requiredAmount: bigint | undefined,
): UseSubscriptionAllowanceResult {
  const { address: senderAddress } = useAccount()

  const enabled =
    !!senderAddress &&
    !!SUBSCRIPTION_MANAGER_ADDRESS &&
    !!tokenAddress

  const {
    data: allowance,
    isLoading,
    refetch: refetchAllowance,
  } = useReadContract({
    address: tokenAddress ?? zeroAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: senderAddress && SUBSCRIPTION_MANAGER_ADDRESS
      ? [senderAddress, SUBSCRIPTION_MANAGER_ADDRESS]
      : [zeroAddress, zeroAddress],
    query: { enabled },
  })

  const needsApproval =
    !!requiredAmount &&
    requiredAmount > 0n &&
    !isLoading &&
    (allowance === undefined || allowance < requiredAmount)

  // --- Approve tx ---
  const {
    writeContract: writeApprove,
    data: approveTxHash,
    isPending: isApprovePending,
    error: approveWriteError,
    reset: resetApprove,
  } = useWriteContract()

  const {
    isLoading: isApproveConfirming,
    isSuccess: isApproveConfirmed,
    error: approveReceiptError,
  } = useWaitForTransactionReceipt({
    hash: approveTxHash,
    confirmations: 1,
    query: { enabled: !!approveTxHash, retry: 10, retryDelay: 2_000 },
  })

  // Refetch allowance once when approval is confirmed
  const didRefetch = useRef(false)
  useEffect(() => {
    if (isApproveConfirmed && !didRefetch.current) {
      didRefetch.current = true
      refetchAllowance()
    }
    if (!isApproveConfirmed) {
      didRefetch.current = false
    }
  }, [isApproveConfirmed, refetchAllowance])

  const approve = useCallback(() => {
    if (!tokenAddress || !SUBSCRIPTION_MANAGER_ADDRESS) return
    writeApprove({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'approve',
      args: [SUBSCRIPTION_MANAGER_ADDRESS, maxUint256],
    })
  }, [tokenAddress, writeApprove])

  return {
    allowance,
    isLoading,
    needsApproval,
    approve,
    isApprovePending,
    isApproveConfirming,
    isApproveConfirmed,
    approveError: approveWriteError ?? approveReceiptError ?? null,
    resetApprove,
    refetchAllowance: () => refetchAllowance(),
  }
}

// ----------------------------------------------------------------
// useExistingSubscription — find active sub from sender to a creator
// ----------------------------------------------------------------

/**
 * Check if the connected wallet has an active subscription to the given creator.
 * Returns the first active subscription found (most recent), or undefined.
 */
export function useExistingSubscription(
  creatorAddress: `0x${string}` | undefined,
) {
  const { address: senderAddress } = useAccount()

  // Get all subscription IDs for the sender
  const { data: subIds } = useReadContract({
    address: SUBSCRIPTION_MANAGER_ADDRESS ?? zeroAddress,
    abi: subscriptionManagerAbi,
    functionName: 'getSubscriptionsBySubscriber',
    args: [senderAddress!],
    query: {
      enabled: !!senderAddress && !!SUBSCRIPTION_MANAGER_ADDRESS && !!creatorAddress,
    },
  })

  // We need to read each subscription to find one matching the creator.
  // For MVP, we read up to 10 most recent IDs. In practice subscribers
  // will have very few subscriptions.
  const idsToCheck = useMemo(() => {
    if (!subIds) return []
    const ids = subIds as bigint[]
    // Take last 10 (most recent)
    return ids.slice(-10).reverse()
  }, [subIds])

  // Read first subscription (we'll chain through them)
  const { data: sub0 } = useReadContract({
    address: SUBSCRIPTION_MANAGER_ADDRESS ?? zeroAddress,
    abi: subscriptionManagerAbi,
    functionName: 'getSubscription',
    args: [idsToCheck[0]!],
    query: { enabled: idsToCheck.length > 0 },
  })

  const { data: sub1 } = useReadContract({
    address: SUBSCRIPTION_MANAGER_ADDRESS ?? zeroAddress,
    abi: subscriptionManagerAbi,
    functionName: 'getSubscription',
    args: [idsToCheck[1]!],
    query: { enabled: idsToCheck.length > 1 },
  })

  const { data: sub2 } = useReadContract({
    address: SUBSCRIPTION_MANAGER_ADDRESS ?? zeroAddress,
    abi: subscriptionManagerAbi,
    functionName: 'getSubscription',
    args: [idsToCheck[2]!],
    query: { enabled: idsToCheck.length > 2 },
  })

  // Find the first active subscription to the target creator
  const activeSub = useMemo(() => {
    if (!creatorAddress) return undefined
    const candidates = [sub0, sub1, sub2].filter(Boolean) as SubscriptionData[]
    return candidates.find(
      (s) =>
        s.active &&
        s.creator.toLowerCase() === creatorAddress.toLowerCase(),
    )
  }, [sub0, sub1, sub2, creatorAddress])

  return {
    subscription: activeSub,
    hasActiveSubscription: !!activeSub,
  }
}

// ----------------------------------------------------------------
// useCreatorSubscriptions — read all incoming subscriptions for a creator
// ----------------------------------------------------------------

/**
 * Fetch all subscriptions where the given address is the creator (recipient).
 * Reads subscription IDs from the contract, then batch-fetches each detail.
 * Returns both active and inactive subscriptions for status display.
 */
export function useCreatorSubscriptions(creatorAddress: `0x${string}` | undefined) {
  const publicClient = usePublicClient()

  // Get subscription IDs for the creator
  const { data: subIds, isLoading: isLoadingIds } = useReadContract({
    address: SUBSCRIPTION_MANAGER_ADDRESS ?? zeroAddress,
    abi: subscriptionManagerAbi,
    functionName: 'getSubscriptionsByCreator',
    args: [creatorAddress!],
    query: {
      enabled: !!creatorAddress && !!SUBSCRIPTION_MANAGER_ADDRESS,
      refetchInterval: 30_000,
    },
  })

  // Batch-fetch subscription details via TanStack Query
  const ids = useMemo(() => {
    if (!subIds) return []
    return (subIds as bigint[]).slice(-50) // cap at 50 most recent
  }, [subIds])

  const { data: subscriptions, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['creatorSubscriptions', creatorAddress, ids.map(String)],
    queryFn: async () => {
      if (!SUBSCRIPTION_MANAGER_ADDRESS || !publicClient || ids.length === 0) return []
      const results = await Promise.all(
        ids.map((id) =>
          publicClient.readContract({
            address: SUBSCRIPTION_MANAGER_ADDRESS!,
            abi: subscriptionManagerAbi,
            functionName: 'getSubscription',
            args: [id],
          }),
        ),
      )
      return results as SubscriptionData[]
    },
    enabled: ids.length > 0 && !!publicClient,
    refetchInterval: 30_000,
  })

  return {
    subscriptions: subscriptions ?? [],
    isLoading: isLoadingIds || isLoadingDetails,
  }
}

// ----------------------------------------------------------------
// useSubscriberSubscriptions — read all subscriptions for a subscriber
// ----------------------------------------------------------------

/**
 * Fetch all subscriptions created by the connected wallet (as subscriber).
 * Used in the subscriber dashboard to list active/cancelled subs with cancel ability.
 */
export function useSubscriberSubscriptions(subscriberAddress: `0x${string}` | undefined) {
  const publicClient = usePublicClient()

  // Get subscription IDs for the subscriber
  const {
    data: subIds,
    isLoading: isLoadingIds,
    refetch: refetchIds,
  } = useReadContract({
    address: SUBSCRIPTION_MANAGER_ADDRESS ?? zeroAddress,
    abi: subscriptionManagerAbi,
    functionName: 'getSubscriptionsBySubscriber',
    args: [subscriberAddress!],
    query: {
      enabled: !!subscriberAddress && !!SUBSCRIPTION_MANAGER_ADDRESS,
      refetchInterval: 30_000,
    },
  })

  const ids = useMemo(() => {
    if (!subIds) return []
    return (subIds as bigint[]).slice(-50) // cap at 50 most recent
  }, [subIds])

  const {
    data: subscriptions,
    isLoading: isLoadingDetails,
    refetch: refetchDetails,
  } = useQuery({
    queryKey: ['subscriberSubscriptions', subscriberAddress, ids.map(String)],
    queryFn: async () => {
      if (!SUBSCRIPTION_MANAGER_ADDRESS || !publicClient || ids.length === 0) return []
      const results = await Promise.all(
        ids.map((id) =>
          publicClient.readContract({
            address: SUBSCRIPTION_MANAGER_ADDRESS!,
            abi: subscriptionManagerAbi,
            functionName: 'getSubscription',
            args: [id],
          }),
        ),
      )
      return results as SubscriptionData[]
    },
    enabled: ids.length > 0 && !!publicClient,
    refetchInterval: 30_000,
  })

  const refetch = useCallback(() => {
    refetchIds()
    refetchDetails()
  }, [refetchIds, refetchDetails])

  return {
    subscriptions: subscriptions ?? [],
    isLoading: isLoadingIds || isLoadingDetails,
    refetch,
  }
}
