/**
 * Creator registration page.
 * Route: /creator/register
 *
 * Allows a connected wallet to register as a creator:
 *   1. Fill in profile metadata (name, bio, avatar, links)
 *   2. Configure suggested payment tiers
 *   3. Upload metadata to IPFS
 *   4. Call CreatorRegistry.register() on-chain
 *
 * Redirects already-registered creators to the edit page.
 */

'use client'

import { useAccount } from 'wagmi'
import { usePrivy } from '@privy-io/react-auth'
import { useCreatorProfile } from '@/hooks/useCreatorProfile'
import { CreatorProfileForm } from '@/components/creator/CreatorProfileForm'

export default function CreatorRegisterPage() {
  const { ready, authenticated, login } = usePrivy()
  const { address } = useAccount()
  const { isRegistered, isLoading, registryConfigured } = useCreatorProfile(address)

  return (
    <main className="relative min-h-[calc(100vh-53px)] flex flex-col items-center justify-center px-4 py-12">
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-brand-500/[0.03] blur-[120px]" />
      </div>

      <div className="relative max-w-md w-full space-y-6 animate-fade-in">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Create your profile</h1>
          <p className="text-zinc-400 text-sm">
            Set up your creator page so supporters can find and tip you.
          </p>
        </div>

        {/* Content card */}
        <div className="card-elevated p-6">
          {!ready ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <div className="w-4 h-4 border-2 border-zinc-700 border-t-brand-400 rounded-full animate-spin" />
              <p className="text-zinc-500 text-sm font-mono">Loading...</p>
            </div>
          ) : !authenticated ? (
            <div className="text-center space-y-4 py-4">
              <p className="text-zinc-400 text-sm">
                Connect your wallet to register as a creator.
              </p>
              <button onClick={login} className="btn-primary">
                Connect wallet
              </button>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <div className="w-4 h-4 border-2 border-zinc-700 border-t-brand-400 rounded-full animate-spin" />
              <p className="text-zinc-500 text-sm font-mono">Checking registration...</p>
            </div>
          ) : isRegistered ? (
            <div className="text-center space-y-4 py-4">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-400/10 border border-brand-400/20">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                <span className="text-brand-400 text-xs font-medium">Already registered</span>
              </div>
              <p className="text-zinc-400 text-sm">
                You&apos;re already registered as a creator.
              </p>
              <div className="flex flex-col items-center gap-2">
                <a href="/creator/edit" className="btn-primary text-sm">
                  Edit your profile
                </a>
                {address && (
                  <a
                    href={`/pay/${address}`}
                    className="text-zinc-500 text-xs hover:text-zinc-300 transition-colors"
                  >
                    View your creator page
                  </a>
                )}
              </div>
            </div>
          ) : !registryConfigured ? (
            <div className="text-center space-y-2 py-6">
              <p className="text-amber-400 text-sm">
                Creator registry is not configured on this deployment.
              </p>
              <p className="text-zinc-600 text-xs">
                The contract address must be set in the environment.
              </p>
            </div>
          ) : (
            <CreatorProfileForm mode="register" />
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
