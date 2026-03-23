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
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full space-y-6">
        {/* Recipient header */}
        <div className="text-center">
          <p className="text-zinc-400 text-sm font-mono mb-1">sending to</p>
          <h2 className="text-2xl font-bold font-mono break-all">{displayName}</h2>
          {/* Show raw address below ENS name */}
          {ensName && address && (
            <p className="text-zinc-600 text-xs font-mono mt-1">
              {address.slice(0, 6)}...{address.slice(-4)}
            </p>
          )}
          {/* Registration badge */}
          {isRegistered && profile?.active && (
            <p className="text-zinc-500 text-xs mt-2">Registered creator</p>
          )}
        </div>

        {/* Payment card */}
        <div className="border border-zinc-800 rounded-lg p-6">
          {isResolvingRecipient ? (
            <p className="text-zinc-500 text-sm text-center font-mono">
              Resolving recipient...
            </p>
          ) : resolveError ? (
            <div className="text-center space-y-2">
              <p className="text-red-400 text-sm">Could not resolve recipient</p>
              <p className="text-zinc-600 text-xs font-mono break-all">
                {resolveError.message}
              </p>
            </div>
          ) : !address ? (
            <p className="text-zinc-500 text-sm text-center">
              Invalid address or ENS name.
            </p>
          ) : isLoadingProfile ? (
            <p className="text-zinc-500 text-sm text-center font-mono">
              Loading profile...
            </p>
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
