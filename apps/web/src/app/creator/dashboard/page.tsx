/**
 * Creator dashboard page.
 * Route: /creator/dashboard
 *
 * Shows the connected creator their:
 *   - Earnings summary (total received by token)
 *   - Recent incoming tips
 *   - Quick links to profile management
 *
 * Only accessible to registered creators.
 */

'use client'

import { useMemo } from 'react'
import { useAccount } from 'wagmi'
import { usePrivy } from '@privy-io/react-auth'
import { zeroAddress, formatUnits } from 'viem'
import { useCreatorProfile } from '@/hooks/useCreatorProfile'
import { useCreatorMetadata } from '@/hooks/useCreatorMetadata'
import { useTipHistory, type TipEvent } from '@/hooks/useTipHistory'
import { TipHistory } from '@/components/payment/TipHistory'
import { StreamDashboard } from '@/components/payment/StreamDashboard'
import { SubscriptionDashboard } from '@/components/payment/SubscriptionDashboard'

/** Aggregate tips by token into totals. */
interface TokenTotal {
  tokenAddress: `0x${string}`
  symbol: string
  totalFormatted: string
  count: number
}

function aggregateByToken(tips: readonly TipEvent[]): TokenTotal[] {
  const map = new Map<string, { raw: bigint; symbol: string; decimals: number; count: number }>()

  for (const tip of tips) {
    const key = tip.tokenAddress.toLowerCase()
    const existing = map.get(key)
    if (existing) {
      map.set(key, {
        ...existing,
        raw: existing.raw + tip.amountRaw,
        count: existing.count + 1,
      })
    } else {
      map.set(key, {
        raw: tip.amountRaw,
        symbol: tip.tokenSymbol,
        decimals: tip.tokenDecimals,
        count: 1,
      })
    }
  }

  return Array.from(map.entries()).map(([addr, data]) => ({
    tokenAddress: addr as `0x${string}`,
    symbol: data.symbol,
    totalFormatted: formatUnits(data.raw, data.decimals),
    count: data.count,
  }))
}

export default function CreatorDashboardPage() {
  const { ready, authenticated, login } = usePrivy()
  const { address } = useAccount()
  const {
    profile,
    isRegistered,
    isLoading: isLoadingProfile,
    registryConfigured,
  } = useCreatorProfile(address)

  const {
    metadata,
    avatarUrl,
    isLoading: isLoadingMetadata,
  } = useCreatorMetadata(profile?.metadataIpfsHash)

  const { tips, isLoading: isLoadingTips } = useTipHistory(address, 'received')

  const tokenTotals = useMemo(() => aggregateByToken(tips), [tips])

  const displayName = metadata?.displayName
    ?? (address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Creator')

  const isStillLoading =
    isLoadingProfile || (!!profile?.metadataIpfsHash && isLoadingMetadata)

  return (
    <main className="relative min-h-[calc(100vh-53px)] flex flex-col items-center px-4 py-12">
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-brand-500/[0.03] blur-[120px]" />
      </div>

      <div className="relative max-w-2xl w-full space-y-6 animate-fade-in">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Creator Dashboard</h1>
          <p className="text-zinc-400 text-sm">
            Track your tips and manage your creator profile.
          </p>
        </div>

        {/* Auth & registration gates */}
        {!ready ? (
          <LoadingCard message="Loading..." />
        ) : !authenticated ? (
          <div className="card-elevated p-6 text-center space-y-4">
            <p className="text-zinc-400 text-sm">
              Connect your wallet to view your creator dashboard.
            </p>
            <button onClick={login} className="btn-primary">
              Connect wallet
            </button>
          </div>
        ) : isStillLoading ? (
          <LoadingCard message="Loading profile..." />
        ) : !registryConfigured ? (
          <div className="card-elevated p-6 text-center space-y-2">
            <p className="text-amber-400 text-sm">
              Creator registry is not configured on this deployment.
            </p>
            <p className="text-zinc-600 text-xs">
              The contract address must be set in the environment.
            </p>
          </div>
        ) : !isRegistered ? (
          <div className="card-elevated p-6 text-center space-y-4">
            <p className="text-zinc-400 text-sm">
              You&apos;re not registered as a creator yet.
            </p>
            <a href="/creator/register" className="btn-primary inline-block text-sm">
              Register now
            </a>
          </div>
        ) : (
          <>
            {/* Profile summary */}
            <div className="card-elevated p-6">
              <div className="flex items-center gap-4">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={`${displayName} avatar`}
                    className="w-14 h-14 rounded-full object-cover border-2 border-zinc-800"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                    <span className="text-lg font-bold text-zinc-500">
                      {displayName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold truncate">{displayName}</h2>
                  {metadata?.bio && (
                    <p className="text-zinc-500 text-sm truncate">{metadata.bio}</p>
                  )}
                </div>
                <a
                  href="/creator/edit"
                  className="btn-secondary !py-1.5 !px-3 !text-xs flex-shrink-0"
                >
                  Edit profile
                </a>
              </div>

              {/* Quick links */}
              {address && (
                <div className="mt-4 pt-4 border-t border-zinc-800 flex flex-wrap gap-2">
                  <a
                    href={`/pay/${address}`}
                    className="text-xs text-zinc-500 hover:text-brand-400 transition-colors font-mono"
                  >
                    View your tip page
                  </a>
                </div>
              )}
            </div>

            {/* Earnings summary */}
            <div className="card-elevated p-6">
              <p className="label mb-4">Earnings (last ~7 days)</p>
              {isLoadingTips ? (
                <LoadingSpinner />
              ) : tokenTotals.length === 0 ? (
                <p className="text-zinc-600 text-sm text-center py-2">
                  No tips received yet. Share your tip page to get started!
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {tokenTotals.map((total) => (
                    <div
                      key={total.tokenAddress}
                      className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/40 border border-zinc-800"
                    >
                      <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-mono font-medium text-zinc-400">
                          {total.tokenAddress === zeroAddress ? 'Ξ' : total.symbol.slice(0, 2)}
                        </span>
                      </div>
                      <div>
                        <p className="text-lg font-bold font-mono">
                          {formatEarnings(total.totalFormatted)} {total.symbol}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {total.count} {total.count === 1 ? 'tip' : 'tips'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active streams */}
            {address && (
              <div className="card-elevated p-4">
                <p className="label mb-3">Active streams</p>
                <StreamDashboard address={address} />
              </div>
            )}

            {/* Subscriptions */}
            {address && (
              <div className="card-elevated p-4">
                <p className="label mb-3">Subscriptions</p>
                <SubscriptionDashboard address={address} />
              </div>
            )}

            {/* Recent tips */}
            {address && (
              <div className="card-elevated p-4">
                <p className="label mb-3">Recent tips</p>
                <TipHistory address={address} limit={20} />
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <p className="text-zinc-700 text-xs text-center font-mono">
          tips.boilerhaus.org &middot; built on Base
        </p>
      </div>
    </main>
  )
}

function LoadingCard({ message }: { message: string }) {
  return (
    <div className="card-elevated p-6">
      <div className="flex items-center justify-center gap-2 py-8">
        <div className="w-4 h-4 border-2 border-zinc-700 border-t-brand-400 rounded-full animate-spin" />
        <p className="text-zinc-500 text-sm font-mono">{message}</p>
      </div>
    </div>
  )
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center gap-2 py-4">
      <div className="w-3 h-3 border-2 border-zinc-700 border-t-brand-400 rounded-full animate-spin" />
      <p className="text-zinc-600 text-xs font-mono">Loading earnings...</p>
    </div>
  )
}

/** Format earnings for display — trim trailing zeros, show reasonable precision. */
function formatEarnings(amount: string): string {
  const num = Number(amount)
  if (num === 0) return '0'
  if (num >= 1) return num.toLocaleString('en-US', { maximumFractionDigits: 2 })
  return num.toPrecision(4).replace(/\.?0+$/, '')
}
