/**
 * Hook for wrapping ERC-20 tokens into Superfluid Super Tokens
 * and unwrapping back.
 *
 * Two flows:
 *   - ERC-20 → Super Token: approve underlying + call upgrade(amount)
 *   - Native ETH → ETHx: call upgradeByETH() with ETH value
 *
 * The Super Token contract itself is the spender for the approve step.
 */

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { erc20Abi, maxUint256, parseUnits } from 'viem'
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useBalance,
  useAccount,
} from 'wagmi'
import { superTokenAbi } from '@sfpro/sdk/abi'
import type { SuperTokenConfig } from '@/lib/superfluid'

type WrapStep = 'idle' | 'approving' | 'wrapping' | 'done'

interface UseWrapSuperTokenResult {
  /** Current step in the wrap flow. */
  step: WrapStep
  /** Whether the underlying ERC-20 needs approval for the Super Token. */
  needsApproval: boolean
  /** Execute the approve transaction. */
  approve: () => void
  /** Execute the wrap (upgrade) transaction. */
  wrap: (amount: string) => void
  /** Wrap native ETH into ETHx. */
  wrapETH: (amount: string) => void
  /** Super Token balance (bigint, 18 decimals). */
  superBalance: bigint | undefined
  /** Underlying token balance. */
  underlyingBalance: bigint | undefined
  /** Any error from the current step. */
  error: Error | null
  /** Reset to idle state. */
  reset: () => void
  /** Pending state for UI spinners. */
  isPending: boolean
}

export function useWrapSuperToken(
  superToken: SuperTokenConfig | undefined,
  wrapAmount: string,
): UseWrapSuperTokenResult {
  const { address: account } = useAccount()
  const [step, setStep] = useState<WrapStep>('idle')

  // --- Underlying ERC-20 balance ---
  const { data: underlyingBalanceData } = useBalance({
    address: account,
    token: superToken?.underlyingAddress,
    query: { enabled: !!account && !!superToken && !superToken.isNativeWrapper },
  })
  // Native ETH balance
  const { data: ethBalanceData } = useBalance({
    address: account,
    query: { enabled: !!account && !!superToken?.isNativeWrapper },
  })

  const underlyingBalance = superToken?.isNativeWrapper
    ? ethBalanceData?.value
    : underlyingBalanceData?.value

  // --- Super Token balance ---
  const { data: superBalanceData, refetch: refetchSuperBalance } = useBalance({
    address: account,
    token: superToken?.address,
    query: { enabled: !!account && !!superToken },
  })

  // --- ERC-20 allowance check (only for non-native Super Tokens) ---
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: superToken?.underlyingAddress!,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [account!, superToken?.address!],
    query: {
      enabled: !!account && !!superToken && !superToken.isNativeWrapper && !!superToken.underlyingAddress,
    },
  })

  // --- Approve transaction ---
  const {
    writeContract: writeApprove,
    data: approveTxHash,
    isPending: isApprovePending,
    error: approveError,
    reset: resetApprove,
  } = useWriteContract()

  const { isSuccess: isApproveConfirmed } = useWaitForTransactionReceipt({
    hash: approveTxHash,
    query: { enabled: !!approveTxHash, retry: 10, retryDelay: 2_000 },
  })

  // Refetch allowance after approval confirms
  const didRefetchAllowance = useRef(false)
  useEffect(() => {
    if (isApproveConfirmed && !didRefetchAllowance.current) {
      didRefetchAllowance.current = true
      refetchAllowance()
      setStep('idle')
    }
    if (!isApproveConfirmed) {
      didRefetchAllowance.current = false
    }
  }, [isApproveConfirmed, refetchAllowance])

  // --- Wrap (upgrade) transaction ---
  const {
    writeContract: writeWrap,
    data: wrapTxHash,
    isPending: isWrapPending,
    error: wrapError,
    reset: resetWrap,
  } = useWriteContract()

  const { isSuccess: isWrapConfirmed } = useWaitForTransactionReceipt({
    hash: wrapTxHash,
    query: { enabled: !!wrapTxHash, retry: 10, retryDelay: 2_000 },
  })

  // Refetch super token balance after wrap confirms
  const didRefetchSuper = useRef(false)
  useEffect(() => {
    if (isWrapConfirmed && !didRefetchSuper.current) {
      didRefetchSuper.current = true
      refetchSuperBalance()
      setStep('done')
    }
    if (!isWrapConfirmed) {
      didRefetchSuper.current = false
    }
  }, [isWrapConfirmed, refetchSuperBalance])

  // --- Derived state ---
  const requiredAllowance = useMemo(() => {
    if (!superToken || superToken.isNativeWrapper) return undefined
    const trimmed = wrapAmount.trim()
    if (!trimmed) return undefined

    try {
      return parseUnits(trimmed, superToken.underlyingDecimals)
    } catch {
      return undefined
    }
  }, [superToken, wrapAmount])

  const needsApproval =
    !!superToken &&
    !superToken.isNativeWrapper &&
    requiredAllowance !== undefined &&
    (allowance === undefined || allowance < requiredAllowance)

  const approve = useCallback(() => {
    if (!superToken?.underlyingAddress || !superToken.address) return
    setStep('approving')
    writeApprove({
      address: superToken.underlyingAddress,
      abi: erc20Abi,
      functionName: 'approve',
      args: [superToken.address, maxUint256],
    })
  }, [superToken, writeApprove])

  const wrap = useCallback(
    (amount: string) => {
      if (!superToken) return
      // Super Token upgrade expects amount in the *underlying* token decimals
      const amountWei = parseUnits(amount, superToken.underlyingDecimals)
      setStep('wrapping')
      writeWrap({
        address: superToken.address,
        abi: superTokenAbi,
        functionName: 'upgrade',
        args: [amountWei],
      })
    },
    [superToken, writeWrap],
  )

  const wrapETH = useCallback(
    (amount: string) => {
      if (!superToken?.isNativeWrapper) return
      const amountWei = parseUnits(amount, 18)
      setStep('wrapping')
      writeWrap({
        address: superToken.address,
        abi: superTokenAbi,
        functionName: 'upgradeByETH',
        value: amountWei,
      })
    },
    [superToken, writeWrap],
  )

  const reset = useCallback(() => {
    setStep('idle')
    resetApprove()
    resetWrap()
  }, [resetApprove, resetWrap])

  const error = approveError ?? wrapError ?? null
  const isPending = isApprovePending || isWrapPending

  return {
    step,
    needsApproval,
    approve,
    wrap,
    wrapETH,
    superBalance: superBalanceData?.value,
    underlyingBalance,
    error,
    reset,
    isPending,
  }
}
