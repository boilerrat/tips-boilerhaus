/**
 * Dynamic creator payment page.
 * Route: /pay/[recipient]
 *
 * [recipient] can be:
 *   - An ENS name:    /pay/boilerrat.eth
 *   - A raw address:  /pay/0xabc...123
 *
 * Phase 1: Resolve recipient, show tip UI.
 * Phase 2: Add subscription and stream modes.
 */

'use client'

import { useResolveRecipient } from '@/hooks/useResolveRecipient'
import { useCreatorProfile } from '@/hooks/useCreatorProfile'
import { TipForm } from '@/components/payment/TipForm'

interface PayPageProps {
  params: {
    recipient: string
  }
}

export default function PayPage({ params }: PayPageProps) {
  const decoded = decodeURIComponent(params.recipient)

  const {
    address,
    ensName,
    isLoading: isResolvingRecipient,
    error: resolveError,
  } = useResolveRecipient(decoded)

  const {
    profile,
    isRegistered,
    isLoading: isLoadingProfile,
  } = useCreatorProfile(address)

  // Display name: prefer ENS, fall back to truncated address
  const displayName = ensName
    ?? (address ? `${address.slice(0, 6)}...${address.slice(-4)}` : decoded)

  return (
    <main className="relative min-h-[calc(100vh-53px)] flex flex-col items-center justify-center px-4 py-12">
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-brand-500/[0.03] blur-[120px]" />
      </div>

      <div className="relative max-w-md w-full space-y-6 animate-fade-in">
        {/* Recipient header */}
        <div className="text-center space-y-2">
          <p className="label">sending to</p>
          <h2 className="text-3xl font-bold font-mono break-all leading-tight">
            {displayName}
          </h2>
          {/* Show raw address below ENS name */}
          {ensName && address && (
            <p className="text-zinc-600 text-xs font-mono">
              {address.slice(0, 6)}...{address.slice(-4)}
            </p>
          )}
          {/* Registration badge */}
          {isRegistered && profile?.active && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-400/10 border border-brand-400/20">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
              <span className="text-brand-400 text-xs font-medium">Registered creator</span>
            </div>
          )}
        </div>

        {/* Payment card */}
        <div className="card-elevated p-6">
          {isResolvingRecipient ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <div className="w-4 h-4 border-2 border-zinc-700 border-t-brand-400 rounded-full animate-spin" />
              <p className="text-zinc-500 text-sm font-mono">Resolving recipient...</p>
            </div>
          ) : resolveError ? (
            <div className="text-center space-y-2 py-6">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-red-950/40 border border-red-900/40 mb-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
              <p className="text-red-400 text-sm font-medium">Could not resolve recipient</p>
              <p className="text-zinc-600 text-xs font-mono break-all">
                {resolveError.message}
              </p>
            </div>
          ) : !address ? (
            <div className="text-center py-6">
              <p className="text-zinc-500 text-sm">
                Invalid address or ENS name.
              </p>
            </div>
          ) : isLoadingProfile ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <div className="w-4 h-4 border-2 border-zinc-700 border-t-brand-400 rounded-full animate-spin" />
              <p className="text-zinc-500 text-sm font-mono">Loading profile...</p>
            </div>
          ) : (
            <TipForm
              recipientAddress={address}
              displayName={displayName}
              profile={profile}
            />
          )}
        </div>

        {/* Footer */}
        <p className="text-zinc-700 text-xs text-center font-mono">
          tips.boilerhaus.org &middot; built on Base
        </p>
      </div>
    </main>
  )
}
