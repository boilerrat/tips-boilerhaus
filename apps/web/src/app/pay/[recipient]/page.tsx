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

import { useState } from 'react'
import { useResolveRecipient } from '@/hooks/useResolveRecipient'
import { useCreatorProfile } from '@/hooks/useCreatorProfile'
import { useCreatorMetadata } from '@/hooks/useCreatorMetadata'
import { TipForm } from '@/components/payment/TipForm'
import { StreamForm } from '@/components/payment/StreamForm'
import { TipHistory } from '@/components/payment/TipHistory'
import { PaymentModeSelector } from '@/components/payment/PaymentModeSelector'
import { FundWalletBanner } from '@/components/payment/FundWalletBanner'
import { ShareButton } from '@/components/ShareButton'
import { REGISTRY_ADDRESS } from '@/lib/contracts'
import type { PaymentMode } from '@tips/shared'

interface PayPageProps {
  params: {
    recipient: string
  }
}

/** Safely extract hostname from a URL string. Returns null for invalid URLs. */
function safeHostname(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
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

  const {
    metadata,
    avatarUrl,
    isLoading: isLoadingMetadata,
  } = useCreatorMetadata(profile?.metadataIpfsHash)

  // Display name: prefer metadata displayName, then ENS, then truncated address
  const displayName = metadata?.displayName
    ?? ensName
    ?? (address ? `${address.slice(0, 6)}...${address.slice(-4)}` : decoded)

  const [paymentMode, setPaymentMode] = useState<PaymentMode>('tip')

  // Only block on metadata loading when a hash is expected
  const isStillLoading = isLoadingProfile
    || (!!profile?.metadataIpfsHash && isLoadingMetadata)

  return (
    <main className="relative min-h-[calc(100vh-53px)] flex flex-col items-center justify-center px-4 py-12">
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-brand-500/[0.03] blur-[120px]" />
      </div>

      <div className="relative max-w-md w-full space-y-6 animate-fade-in">
        {/* Recipient header */}
        <div className="text-center space-y-3">
          <p className="label">sending to</p>

          {/* Avatar */}
          {avatarUrl && (
            <div className="flex justify-center">
              <img
                src={avatarUrl}
                alt={`${displayName} avatar`}
                className="w-16 h-16 rounded-full object-cover border-2 border-zinc-800"
              />
            </div>
          )}

          <h2 className="text-3xl font-bold font-mono break-all leading-tight">
            {displayName}
          </h2>

          {/* Show raw address below display name / ENS name */}
          {(ensName || metadata?.displayName) && address && (
            <p className="text-zinc-600 text-xs font-mono">
              {address.slice(0, 6)}...{address.slice(-4)}
            </p>
          )}

          {/* Bio */}
          {metadata?.bio && (
            <p className="text-zinc-400 text-sm max-w-xs mx-auto">
              {metadata.bio}
            </p>
          )}

          {/* Social links */}
          {(metadata?.websiteUrl || metadata?.farcasterHandle) && (
            <div className="flex items-center justify-center gap-3 text-xs">
              {metadata.websiteUrl && (() => {
                const hostname = safeHostname(metadata.websiteUrl)
                return hostname ? (
                  <a
                    href={metadata.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-400 hover:text-brand-300 transition-colors"
                  >
                    {hostname}
                  </a>
                ) : null
              })()}
              {metadata.farcasterHandle && (
                <a
                  href={`https://warpcast.com/${metadata.farcasterHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-400 hover:text-brand-300 transition-colors"
                >
                  @{metadata.farcasterHandle}
                </a>
              )}
            </div>
          )}

          {/* Registration badge */}
          {isRegistered && profile?.active && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-400/10 border border-brand-400/20">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
              <span className="text-brand-400 text-xs font-medium">Registered creator</span>
            </div>
          )}

          {/* Share */}
          <ShareButton />
        </div>

        {/* Payment mode selector */}
        <PaymentModeSelector selected={paymentMode} onSelect={setPaymentMode} />

        {/* Empty wallet prompt for first-time users */}
        <FundWalletBanner />

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
          ) : isStillLoading ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <div className="w-4 h-4 border-2 border-zinc-700 border-t-brand-400 rounded-full animate-spin" />
              <p className="text-zinc-500 text-sm font-mono">Loading profile...</p>
            </div>
          ) : paymentMode === 'stream' ? (
            <StreamForm
              recipientAddress={address}
              displayName={displayName}
            />
          ) : (
            <TipForm
              recipientAddress={address}
              displayName={displayName}
              profile={profile}
            />
          )}
        </div>

        {/* Recent tips */}
        {address && REGISTRY_ADDRESS && (
          <div className="card-elevated p-4">
            <p className="label mb-3">Recent tips</p>
            <TipHistory address={address} limit={5} />
          </div>
        )}

        {/* Footer */}
        <p className="text-zinc-700 text-xs text-center font-mono">
          tips.boilerhaus.org &middot; built on Base
        </p>
      </div>
    </main>
  )
}
