/**
 * Persistent site header with wallet connection controls.
 * Shown on all pages via the root layout.
 */

'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useAccount, useSwitchChain } from 'wagmi'
import { base, baseSepolia } from 'viem/chains'
import { useCreatorProfile } from '@/hooks/useCreatorProfile'
import { env } from '@/env'
import { SUPPORTED_CHAINS, type SupportedChainId } from '@/lib/wagmi'

export function Header() {
  const { ready, authenticated, login, logout } = usePrivy()
  const { address, chain } = useAccount()
  const { switchChain } = useSwitchChain()
  const { isRegistered } = useCreatorProfile(address)

  // Derive target chain from env — baseSepolia for dev, base for prod
  const targetChainId = env.NEXT_PUBLIC_DEFAULT_CHAIN_ID as SupportedChainId
  const targetChain = SUPPORTED_CHAINS[targetChainId] ?? baseSepolia
  const isWrongChain = authenticated && chain && chain.id !== targetChain.id

  const displayAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : null

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-900/80 bg-black/80 backdrop-blur-md px-3 sm:px-4 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
        <a
          href="/"
          className="flex items-center gap-2 text-sm font-bold font-mono hover:text-brand-400 transition-colors duration-200 flex-shrink-0"
        >
          <span className="inline-block w-2 h-2 rounded-full bg-brand-400" />
          <span className="hidden xs:inline">boilerhaus</span> tips
        </a>

        <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap justify-end">
          {ready && (
            authenticated ? (
              <>
                {/* Creator page links — visible on all sizes */}
                {isRegistered ? (
                  <>
                    <a
                      href="/creator/dashboard"
                      className="px-2 sm:px-3 py-1.5 text-xs text-zinc-500 hover:text-brand-400 transition-colors duration-200"
                    >
                      Dashboard
                    </a>
                    <a
                      href="/creator/edit"
                      className="hidden sm:inline-block px-3 py-1.5 text-xs text-zinc-500 hover:text-brand-400 transition-colors duration-200"
                    >
                      Edit profile
                    </a>
                  </>
                ) : (
                  <a
                    href="/creator/register"
                    className="px-2 sm:px-3 py-1.5 text-xs text-zinc-500 hover:text-brand-400 transition-colors duration-200"
                  >
                    <span className="sm:hidden">Create</span>
                    <span className="hidden sm:inline">Become a creator</span>
                  </a>
                )}

                {isWrongChain ? (
                  <button
                    onClick={() => switchChain({ chainId: targetChain.id })}
                    className="px-2 sm:px-3 py-1.5 text-xs border border-red-800/60 rounded-lg text-red-400 hover:text-red-300 hover:border-red-600 hover:bg-red-950/30 transition-all duration-200"
                  >
                    <span className="sm:hidden">Wrong chain</span>
                    <span className="hidden sm:inline">Switch to {targetChain.name}</span>
                  </button>
                ) : chain && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-zinc-600 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/60" />
                    {chain.name}
                  </span>
                )}
                {displayAddress && (
                  <span className="hidden sm:inline-block px-2.5 py-1 text-xs text-zinc-400 font-mono bg-zinc-900/60 rounded-lg border border-zinc-800/60">
                    {displayAddress}
                  </span>
                )}
                <button
                  onClick={logout}
                  className="px-2 sm:px-3 py-1.5 text-xs border border-zinc-800 rounded-lg text-zinc-500 hover:text-white hover:border-zinc-600 hover:bg-zinc-900/60 transition-all duration-200"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                onClick={login}
                className="btn-primary !py-1.5 !px-4 !text-xs !rounded-lg"
              >
                Connect
              </button>
            )
          )}
        </div>
      </div>
    </header>
  )
}
