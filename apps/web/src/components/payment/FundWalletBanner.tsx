/**
 * FundWalletBanner — Prompts new users with empty wallets to fund via Coinbase Onramp.
 *
 * Shown on the pay page when a connected wallet has zero ETH and zero USDC.
 * Guides first-time crypto users through the funding step before they can tip.
 */

'use client'

import { useAccount, useBalance, useChainId } from 'wagmi'
import { usePrivy } from '@privy-io/react-auth'
import { useCoinbaseOnramp, type OnrampStatus } from '@/hooks/useCoinbaseOnramp'
import { getTokensForChain } from '@/lib/tokens'

/** USDC address on the current chain, if it exists in our token list. */
function getUsdcAddress(chainId: number): `0x${string}` | undefined {
  const tokens = getTokensForChain(chainId)
  const usdc = tokens.find((t) => t.symbol === 'USDC')
  return usdc?.address
}

export function FundWalletBanner() {
  const { authenticated } = usePrivy()
  const { address } = useAccount()
  const chainId = useChainId()
  const usdcAddress = getUsdcAddress(chainId)

  const { data: ethBalance } = useBalance({
    address,
    query: { enabled: !!address },
  })

  const { data: usdcBalance, refetch: refetchUsdc } = useBalance({
    address,
    token: usdcAddress,
    query: { enabled: !!address && !!usdcAddress },
  })

  const {
    openOnramp,
    status: onrampStatus,
    error: onrampError,
    reset: resetOnramp,
  } = useCoinbaseOnramp({
    senderAddress: address,
    refetchBalance: async () => {
      const result = await refetchUsdc()
      return result.data
    },
  })

  // Only show when wallet is connected and both balances are zero
  if (!authenticated || !address) return null
  if (!ethBalance || !usdcBalance) return null

  const hasZeroEth = ethBalance.value === BigInt(0)
  const hasZeroUsdc = usdcBalance.value === BigInt(0)

  if (!hasZeroEth || !hasZeroUsdc) return null

  // Hide after successful funding
  if (onrampStatus === 'success') return null

  const isOnrampBusy = onrampStatus === 'loading' || onrampStatus === 'pending' || onrampStatus === 'polling'

  return (
    <div className="card-elevated p-5 space-y-3 animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5 w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </div>
        <div className="space-y-1">
          <p className="text-white text-sm font-medium">Fund your wallet to get started</p>
          <p className="text-zinc-400 text-xs leading-relaxed">
            Your wallet is empty. Buy USDC with a bank card — zero fees on Base via Coinbase. You&apos;ll go through a quick
            verification, then funds appear in your wallet within minutes.
          </p>
        </div>
      </div>

      <button
        onClick={openOnramp}
        disabled={isOnrampBusy}
        className="w-full py-2.5 px-4 text-sm font-medium rounded-xl bg-blue-500 text-white hover:bg-blue-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {onrampStatus === 'loading' ? (
          <span className="inline-flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-blue-300 border-t-white rounded-full animate-spin" />
            Connecting to Coinbase...
          </span>
        ) : onrampStatus === 'pending' ? (
          <span className="inline-flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-blue-300 border-t-white rounded-full animate-spin" />
            Complete your purchase in the popup...
          </span>
        ) : onrampStatus === 'polling' ? (
          <span className="inline-flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-blue-300 border-t-white rounded-full animate-spin" />
            Waiting for USDC to arrive...
          </span>
        ) : (
          'Buy USDC with card'
        )}
      </button>

      {onrampError && (
        <div className="flex items-start gap-2">
          <p className="text-red-400 text-xs font-mono">{onrampError}</p>
          <button
            onClick={resetOnramp}
            className="text-zinc-500 text-xs hover:text-zinc-300 transition-colors shrink-0"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  )
}
