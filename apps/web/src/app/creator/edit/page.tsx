/**
 * Creator profile edit page.
 * Route: /creator/edit
 *
 * Pre-populates the form with existing on-chain profile + IPFS metadata,
 * then calls CreatorRegistry.updateProfile() on submit.
 *
 * Only accessible to registered creators — unregistered wallets are
 * directed to the registration page.
 */

'use client'

import { useAccount } from 'wagmi'
import { usePrivy } from '@privy-io/react-auth'
import { useCreatorProfile } from '@/hooks/useCreatorProfile'
import { useCreatorMetadata } from '@/hooks/useCreatorMetadata'
import { CreatorProfileForm } from '@/components/creator/CreatorProfileForm'

export default function CreatorEditPage() {
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
    isLoading: isLoadingMetadata,
  } = useCreatorMetadata(profile?.metadataIpfsHash)

  // Wait for both profile and metadata to load before rendering the form
  const isStillLoading =
    isLoadingProfile || (!!profile?.metadataIpfsHash && isLoadingMetadata)

  return (
    <main className="relative min-h-[calc(100vh-53px)] flex flex-col items-center justify-center px-4 py-12">
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-brand-500/[0.03] blur-[120px]" />
      </div>

      <div className="relative max-w-md w-full space-y-6 animate-fade-in">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Edit your profile</h1>
          <p className="text-zinc-400 text-sm">
            Update your creator page details and suggested tip amounts.
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
                Connect your wallet to edit your creator profile.
              </p>
              <button onClick={login} className="btn-primary">
                Connect wallet
              </button>
            </div>
          ) : isStillLoading ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <div className="w-4 h-4 border-2 border-zinc-700 border-t-brand-400 rounded-full animate-spin" />
              <p className="text-zinc-500 text-sm font-mono">Loading profile...</p>
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
          ) : !isRegistered ? (
            <div className="text-center space-y-4 py-4">
              <p className="text-zinc-400 text-sm">
                You&apos;re not registered as a creator yet.
              </p>
              <a href="/creator/register" className="btn-primary inline-block text-sm">
                Register now
              </a>
            </div>
          ) : (
            <CreatorProfileForm
              mode="edit"
              initialMetadata={metadata}
              initialTiers={profile?.tiers}
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
