/**
 * Shared form for creator registration and profile editing.
 *
 * Handles:
 *   - Metadata input (displayName, bio, avatar, website, farcaster)
 *   - Avatar upload to IPFS via /api/ipfs/pin
 *   - Payment tier configuration (label, amount, token, mode)
 *   - Metadata JSON pinning to IPFS
 *   - Contract call (register or updateProfile)
 *
 * Used by /creator/register and /creator/edit pages.
 */

'use client'

import { useState, useCallback, useMemo } from 'react'
import { parseUnits, formatUnits, type Address, zeroAddress } from 'viem'
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
  useChainId,
} from 'wagmi'
import { usePrivy } from '@privy-io/react-auth'
import { creatorRegistryAbi, REGISTRY_ADDRESS } from '@/lib/contracts'
import { getTokensForChain } from '@/lib/tokens'
import { ipfsToHttpUrl, isIpfsUri } from '@/lib/ipfs'
import type { CreatorMetadata, PaymentTier, PaymentMode } from '@tips/shared'

/** Form mode — determines which contract function to call. */
export type ProfileFormMode = 'register' | 'edit'

/** A tier in the form state — uses string amounts for input convenience. */
interface TierFormState {
  id: string
  label: string
  amount: string
  tokenIndex: number
  mode: PaymentMode
}

interface CreatorProfileFormProps {
  mode: ProfileFormMode
  /** Pre-populated metadata for edit mode. */
  initialMetadata?: CreatorMetadata | undefined
  /** Pre-populated tiers for edit mode. */
  initialTiers?: PaymentTier[] | undefined
}

/** Generate a unique ID for tier form rows. */
function generateId(): string {
  return crypto.randomUUID()
}

/** Check if a string is a valid positive decimal number. */
function isValidDecimal(value: string): boolean {
  return /^\d+(\.\d+)?$/.test(value) && Number(value) > 0
}

/** Resolve an avatar URL — convert ipfs:// URIs to HTTP gateway URLs. */
function resolveAvatarDisplay(url: string): string {
  return isIpfsUri(url) ? ipfsToHttpUrl(url) : url
}

/** Map shared PaymentTier to form state. */
function tierToFormState(
  tier: PaymentTier,
  tokens: ReturnType<typeof getTokensForChain>,
): TierFormState {
  const tokenIndex = tier.tokenAddress
    ? tokens.findIndex(
        (t) => t.address?.toLowerCase() === tier.tokenAddress?.toLowerCase(),
      )
    : 0 // ETH is index 0

  const matchedToken = tokens[tokenIndex === -1 ? 0 : tokenIndex]
  const decimals = matchedToken?.decimals ?? 18

  return {
    id: generateId(),
    label: tier.label,
    amount: formatUnits(tier.amountWei, decimals),
    tokenIndex: tokenIndex === -1 ? 0 : tokenIndex,
    mode: tier.mode,
  }
}

export function CreatorProfileForm({
  mode,
  initialMetadata,
  initialTiers,
}: CreatorProfileFormProps) {
  const { ready, authenticated, login } = usePrivy()
  const { address: senderAddress } = useAccount()
  const chainId = useChainId()
  const tokens = useMemo(() => getTokensForChain(chainId), [chainId])

  // --- Metadata state ---
  const [displayName, setDisplayName] = useState(initialMetadata?.displayName ?? '')
  const [bio, setBio] = useState(initialMetadata?.bio ?? '')
  const [websiteUrl, setWebsiteUrl] = useState(initialMetadata?.websiteUrl ?? '')
  const [farcasterHandle, setFarcasterHandle] = useState(
    initialMetadata?.farcasterHandle ?? '',
  )

  // Avatar state — either an existing IPFS URL or a new file to upload
  const [existingAvatarUrl, setExistingAvatarUrl] = useState(
    initialMetadata?.avatarUrl ?? '',
  )
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  // --- Tiers state ---
  const [tiers, setTiers] = useState<TierFormState[]>(() =>
    initialTiers?.map((t) => tierToFormState(t, tokens)) ?? [],
  )

  // Reset tier token indices when chain changes (token list may differ)
  const [prevChainId, setPrevChainId] = useState(chainId)
  if (chainId !== prevChainId) {
    setPrevChainId(chainId)
    setTiers(initialTiers?.map((t) => tierToFormState(t, tokens)) ?? [])
  }

  // --- Upload / submit state ---
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // --- Contract write ---
  const {
    writeContract,
    data: txHash,
    isPending: isContractPending,
    error: contractError,
    reset: resetContract,
  } = useWriteContract()

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
  } = useWaitForTransactionReceipt({
    hash: txHash,
    confirmations: 1,
    query: {
      enabled: !!txHash,
      retry: 10,
      retryDelay: 2_000,
    },
  })

  const isBusy = isUploading || isContractPending || isConfirming

  // Block explorer URL
  const explorerUrl =
    chainId === 8453
      ? 'https://basescan.org'
      : 'https://sepolia.basescan.org'

  // --- Avatar handling ---
  const handleAvatarChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      setAvatarFile(file)
      setExistingAvatarUrl('')

      // Create a preview URL
      const reader = new FileReader()
      reader.onload = () => setAvatarPreview(reader.result as string)
      reader.readAsDataURL(file)
    },
    [],
  )

  const clearAvatar = useCallback(() => {
    setAvatarFile(null)
    setAvatarPreview(null)
    setExistingAvatarUrl('')
  }, [])

  // --- Tier management ---
  const addTier = useCallback(() => {
    setTiers((prev) => [
      ...prev,
      {
        id: generateId(),
        label: '',
        amount: '',
        tokenIndex: 0,
        mode: 'tip' as PaymentMode,
      },
    ])
  }, [])

  const removeTier = useCallback((id: string) => {
    setTiers((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const updateTier = useCallback(
    (id: string, field: keyof Omit<TierFormState, 'id'>, value: string | number) => {
      setTiers((prev) =>
        prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)),
      )
    },
    [],
  )

  // --- Submit ---
  const handleSubmit = useCallback(async () => {
    if (!senderAddress || !REGISTRY_ADDRESS) return
    setUploadError(null)
    setIsUploading(true)

    try {
      // Step 1: Upload avatar if a new file is selected
      let avatarIpfsUrl = existingAvatarUrl || undefined

      if (avatarFile) {
        const formData = new FormData()
        formData.append('file', avatarFile)

        const avatarRes = await fetch('/api/ipfs/pin', {
          method: 'POST',
          body: formData,
        })

        if (!avatarRes.ok) {
          const err = await avatarRes.json()
          throw new Error(err.error ?? 'Failed to upload avatar')
        }

        const { cid } = await avatarRes.json()
        avatarIpfsUrl = `ipfs://${cid}`
      }

      // Step 2: Build metadata JSON and pin to IPFS
      const metadata: CreatorMetadata = {
        displayName: displayName.trim(),
        ...(bio.trim() && { bio: bio.trim() }),
        ...(avatarIpfsUrl && { avatarUrl: avatarIpfsUrl }),
        ...(websiteUrl.trim() && { websiteUrl: websiteUrl.trim() }),
        ...(farcasterHandle.trim() && {
          farcasterHandle: farcasterHandle.trim(),
        }),
      }

      const metadataRes = await fetch('/api/ipfs/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata),
      })

      if (!metadataRes.ok) {
        const err = await metadataRes.json()
        throw new Error(err.error ?? 'Failed to pin metadata')
      }

      const { cid: metadataCid } = await metadataRes.json()

      // Step 3: Validate tier amounts before parsing
      const filledTiers = tiers.filter((t) => t.label.trim() && t.amount.trim())
      for (const t of filledTiers) {
        if (!isValidDecimal(t.amount)) {
          throw new Error(`Invalid amount "${t.amount}" for tier "${t.label}". Enter a positive number.`)
        }
      }

      // Step 4: Convert tiers to contract format
      const modeMap: Record<PaymentMode, number> = {
        tip: 0,
        subscription: 1,
        stream: 2,
      }
      const contractTiers = filledTiers.map((t) => {
        const token = tokens[t.tokenIndex] ?? tokens[0]
        const amountWei = parseUnits(t.amount, token?.decimals ?? 18)
        return {
          label: t.label.trim(),
          amountWei,
          tokenAddress: (token?.address ?? zeroAddress) as Address,
          mode: modeMap[t.mode],
        }
      })

      // Step 5: Call contract
      const functionName = mode === 'register' ? 'register' : 'updateProfile'

      writeContract({
        address: REGISTRY_ADDRESS,
        abi: creatorRegistryAbi,
        functionName,
        args: [metadataCid, contractTiers],
      })

      setIsUploading(false)
    } catch (err) {
      setIsUploading(false)
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    }
  }, [
    senderAddress,
    avatarFile,
    existingAvatarUrl,
    displayName,
    bio,
    websiteUrl,
    farcasterHandle,
    tiers,
    tokens,
    mode,
    writeContract,
  ])

  const handleReset = useCallback(() => {
    resetContract()
    setUploadError(null)
  }, [resetContract])

  // --- Validation ---
  const isValid = displayName.trim().length > 0 && !!REGISTRY_ADDRESS

  // The current avatar to display (preview of new upload, or existing resolved to HTTP)
  const displayAvatar = avatarPreview
    ?? (existingAvatarUrl ? resolveAvatarDisplay(existingAvatarUrl) : null)

  // --- Success state ---
  if (isConfirmed && txHash) {
    return (
      <div className="space-y-5 text-center py-4 animate-fade-in">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-950/40 border border-emerald-800/40">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-emerald-400"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className="space-y-1">
          <p className="text-white font-semibold text-lg">
            {mode === 'register' ? 'Profile registered!' : 'Profile updated!'}
          </p>
          <p className="text-zinc-400 text-sm">
            Your creator profile is now live on-chain.
          </p>
        </div>
        <div className="flex flex-col items-center gap-3">
          <a
            href={`${explorerUrl}/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-brand-400 transition-colors font-mono"
          >
            View on Basescan
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
          {senderAddress && (
            <a
              href={`/pay/${senderAddress}`}
              className="btn-secondary text-sm"
            >
              View your creator page
            </a>
          )}
          {mode === 'register' && (
            <a href="/creator/edit" className="text-zinc-500 text-xs hover:text-zinc-300 transition-colors">
              Edit your profile
            </a>
          )}
        </div>
      </div>
    )
  }

  // --- Form ---
  return (
    <div className="space-y-6">
      {/* Display Name */}
      <div className="space-y-2.5">
        <label htmlFor="display-name" className="label">
          Display name *
        </label>
        <input
          id="display-name"
          type="text"
          placeholder="Your creator name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          disabled={isBusy}
          maxLength={100}
          className="input-field"
        />
      </div>

      {/* Bio */}
      <div className="space-y-2.5">
        <label htmlFor="bio" className="label">
          Bio
        </label>
        <textarea
          id="bio"
          placeholder="Tell supporters what you do..."
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          disabled={isBusy}
          maxLength={500}
          rows={3}
          className="input-field resize-none"
        />
        {bio.length > 0 && (
          <p className="text-xs text-zinc-600 text-right">{bio.length}/500</p>
        )}
      </div>

      {/* Avatar */}
      <div className="space-y-2.5">
        <p className="label">Avatar</p>
        <div className="flex items-center gap-4">
          {displayAvatar ? (
            <div className="relative">
              <img
                src={displayAvatar}
                alt="Avatar preview"
                className="w-16 h-16 rounded-full object-cover border-2 border-zinc-800"
              />
              <button
                type="button"
                onClick={clearAvatar}
                disabled={isBusy}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                title="Remove avatar"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="w-16 h-16 rounded-full bg-zinc-900 border-2 border-dashed border-zinc-700 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-600">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
          )}
          <label className="btn-secondary text-sm cursor-pointer">
            {displayAvatar ? 'Change' : 'Upload'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
              onChange={handleAvatarChange}
              disabled={isBusy}
              className="hidden"
            />
          </label>
        </div>
        <p className="text-xs text-zinc-600">PNG, JPG, GIF, WebP, or SVG. Max 5 MB.</p>
      </div>

      {/* Website */}
      <div className="space-y-2.5">
        <label htmlFor="website" className="label">
          Website
        </label>
        <input
          id="website"
          type="url"
          placeholder="https://yoursite.com"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          disabled={isBusy}
          className="input-field text-sm"
        />
      </div>

      {/* Farcaster */}
      <div className="space-y-2.5">
        <label htmlFor="farcaster" className="label">
          Farcaster handle
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 text-sm">@</span>
          <input
            id="farcaster"
            type="text"
            placeholder="username"
            value={farcasterHandle}
            onChange={(e) => setFarcasterHandle(e.target.value.replace(/[^a-zA-Z0-9_.-]/g, ''))}
            disabled={isBusy}
            maxLength={20}
            className="input-field text-sm !pl-8"
          />
        </div>
      </div>

      {/* Payment Tiers */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="label">Suggested tip amounts</p>
          <button
            type="button"
            onClick={addTier}
            disabled={isBusy || tiers.length >= 8}
            className="text-xs text-brand-400 hover:text-brand-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            + Add tier
          </button>
        </div>

        {tiers.length === 0 && (
          <p className="text-xs text-zinc-600 py-2">
            No tiers configured. Tippers can still enter any amount.
          </p>
        )}

        {tiers.map((tier) => (
          <div
            key={tier.id}
            className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3"
          >
            <div className="flex items-start gap-3">
              {/* Label */}
              <div className="flex-1 space-y-1.5">
                <label className="text-xs text-zinc-600">Label</label>
                <input
                  type="text"
                  placeholder="e.g. Coffee"
                  value={tier.label}
                  onChange={(e) => updateTier(tier.id, 'label', e.target.value)}
                  disabled={isBusy}
                  maxLength={30}
                  className="input-field !py-2 text-sm"
                />
              </div>
              {/* Amount */}
              <div className="w-28 space-y-1.5">
                <label className="text-xs text-zinc-600">Amount</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.01"
                  value={tier.amount}
                  onChange={(e) => updateTier(tier.id, 'amount', e.target.value)}
                  disabled={isBusy}
                  className="input-field !py-2 text-sm font-mono"
                />
              </div>
              {/* Remove */}
              <button
                type="button"
                onClick={() => removeTier(tier.id)}
                disabled={isBusy}
                className="mt-7 p-1.5 text-zinc-600 hover:text-red-400 transition-colors"
                title="Remove tier"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Token + Mode selectors */}
            <div className="flex gap-2">
              {tokens.map((token, i) => {
                const isSelected = tier.tokenIndex === i
                return (
                  <button
                    key={token.address ?? 'eth'}
                    type="button"
                    onClick={() => updateTier(tier.id, 'tokenIndex', i)}
                    disabled={isBusy}
                    className={`px-3 py-1.5 text-xs font-mono rounded-lg border transition-all duration-200 ${
                      isSelected
                        ? 'text-brand-400 border-brand-400/30 bg-brand-400/[0.06]'
                        : 'text-zinc-500 border-zinc-800 hover:border-zinc-600 hover:text-zinc-300'
                    }`}
                  >
                    {token.symbol}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Registry not configured warning */}
      {!REGISTRY_ADDRESS && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-950/20 border border-amber-900/30">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-amber-400 shrink-0 mt-0.5"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <p className="text-amber-400 text-xs">
            Creator registry contract is not configured. Registration is unavailable.
          </p>
        </div>
      )}

      {/* Submit button */}
      {!ready ? (
        <div className="flex items-center justify-center gap-2 py-3">
          <div className="w-4 h-4 border-2 border-zinc-700 border-t-brand-400 rounded-full animate-spin" />
          <span className="text-zinc-600 text-sm">Loading...</span>
        </div>
      ) : !authenticated ? (
        <button type="button" onClick={login} className="btn-primary w-full">
          Connect wallet to {mode === 'register' ? 'register' : 'save changes'}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isValid || isBusy}
          className="btn-primary w-full"
        >
          {isUploading ? (
            <span className="inline-flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              Uploading to IPFS...
            </span>
          ) : isContractPending ? (
            <span className="inline-flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              Confirm in wallet...
            </span>
          ) : isConfirming ? (
            <span className="inline-flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              Confirming on-chain...
            </span>
          ) : !displayName.trim() ? (
            'Enter a display name'
          ) : mode === 'register' ? (
            'Register as creator'
          ) : (
            'Save changes'
          )}
        </button>
      )}

      {/* Errors */}
      {(uploadError || contractError) && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-950/20 border border-red-900/30">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-red-400 shrink-0 mt-0.5"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div className="space-y-1">
            <p className="text-red-400 text-xs font-mono break-all">
              {(uploadError ?? contractError?.message ?? 'Unknown error').slice(0, 300)}
            </p>
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Confirming indicator */}
      {isConfirming && txHash && (
        <div className="text-center space-y-1">
          <p className="text-zinc-500 text-xs font-mono">
            Waiting for confirmation...
          </p>
          <a
            href={`${explorerUrl}/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-600 text-xs font-mono hover:text-brand-400 transition-colors"
          >
            Track on Basescan
          </a>
        </div>
      )}
    </div>
  )
}
