/**
 * Persistent site header with wallet connection controls.
 * Shown on all pages via the root layout.
 */

'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useAccount, useSwitchChain } from 'wagmi'
import { baseSepolia } from 'viem/chains'

export function Header() {
  const { ready, authenticated, login, logout } = usePrivy()
  const { address, chain } = useAccount()
  const { switchChain } = useSwitchChain()

  // TODO: derive target chain from env (baseSepolia for dev, base for prod)
  const isWrongChain = authenticated && chain && chain.id !== baseSepolia.id

  const displayAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : null

  return (
    <header className="border-b border-zinc-900 px-4 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <a href="/" className="text-sm font-bold font-mono hover:text-zinc-300 transition-colors">
          boilerhaus tips
        </a>

        <div className="flex items-center gap-3">
          {ready && (
            authenticated ? (
              <>
                {isWrongChain ? (
                  <button
                    onClick={() => switchChain({ chainId: baseSepolia.id })}
                    className="px-3 py-1 text-xs border border-red-800 rounded text-red-400 hover:text-red-300 hover:border-red-600 transition-colors"
                  >
                    Switch to Base Sepolia
                  </button>
                ) : chain && (
                  <span className="text-xs text-zinc-600 font-mono hidden sm:inline">
                    {chain.name}
                  </span>
                )}
                {displayAddress && (
                  <span className="text-xs text-zinc-400 font-mono">
                    {displayAddress}
                  </span>
                )}
                <button
                  onClick={logout}
                  className="px-3 py-1 text-xs border border-zinc-800 rounded text-zinc-500 hover:text-white hover:border-zinc-600 transition-colors"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                onClick={login}
                className="px-3 py-1 text-xs bg-white text-black font-semibold rounded hover:bg-zinc-200 transition-colors"
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
