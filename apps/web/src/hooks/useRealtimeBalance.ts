/**
 * Hook for animating a Superfluid Super Token balance in real time.
 *
 * Snapshots the on-chain balance via `realtimeBalanceOfNow()`, then
 * extrapolates locally using the net flow rate, updating every second.
 *
 * Formula: currentBalance = snapshot + (netFlowRate * elapsed)
 */

'use client'

import { useState, useEffect } from 'react'
import { useReadContract } from 'wagmi'
import { superTokenAbi } from '@sfpro/sdk/abi'

interface UseRealtimeBalanceResult {
  /** Current extrapolated balance in wei (Super Token decimals = 18). */
  balance: bigint
  /** Whether the initial on-chain snapshot is loading. */
  isLoading: boolean
}

export function useRealtimeBalance(
  superToken: `0x${string}` | undefined,
  account: `0x${string}` | undefined,
  /** Net flow rate in wei/sec. Positive = net incoming, negative = net outgoing. */
  netFlowRate: bigint = 0n,
): UseRealtimeBalanceResult {
  const [displayBalance, setDisplayBalance] = useState<bigint>(0n)

  const { data: snapshot, isLoading } = useReadContract({
    address: superToken!,
    abi: superTokenAbi,
    functionName: 'realtimeBalanceOfNow',
    args: [account!],
    query: {
      enabled: !!superToken && !!account,
      refetchInterval: 60_000, // re-snapshot every minute for drift correction
    },
  })

  useEffect(() => {
    if (!snapshot) return

    // realtimeBalanceOfNow returns (availableBalance, deposit, owedDeposit, timestamp)
    const [availableBalance, , , snapshotTimestamp] = snapshot as [bigint, bigint, bigint, bigint]

    const tick = () => {
      const nowSeconds = BigInt(Math.floor(Date.now() / 1000))
      const elapsed = nowSeconds - snapshotTimestamp
      const extrapolated = availableBalance + netFlowRate * elapsed
      setDisplayBalance(extrapolated > 0n ? extrapolated : 0n)
    }

    tick()
    const id = setInterval(tick, 1_000)
    return () => clearInterval(id)
  }, [snapshot, netFlowRate])

  return { balance: displayBalance, isLoading }
}
