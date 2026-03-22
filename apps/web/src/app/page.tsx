'use client'

import { usePrivy } from '@privy-io/react-auth'

/**
 * Landing page.
 *
 * Phase 1: Simple placeholder with Privy login.
 * Later: Creator directory, featured profiles, protocol stats.
 */
export default function HomePage() {
  const { ready, authenticated, login, logout, user } = usePrivy()

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-lg w-full text-center space-y-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">boilerhaus tips</h1>
          <p className="text-zinc-400 text-lg">
            Onchain creator support. One-time tips, subscriptions, and real-time streams.
          </p>
        </div>

        {ready && (
          authenticated ? (
            <div className="space-y-4">
              <p className="text-zinc-300 text-sm font-mono">
                {user?.wallet?.address
                  ? `${user.wallet.address.slice(0, 6)}...${user.wallet.address.slice(-4)}`
                  : user?.email?.address ?? 'Connected'}
              </p>
              <button
                onClick={logout}
                className="px-6 py-2 border border-zinc-700 rounded text-sm text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={login}
              className="px-8 py-3 bg-white text-black font-semibold rounded hover:bg-zinc-200 transition-colors"
            >
              Connect
            </button>
          )
        )}

        <p className="text-zinc-600 text-sm font-mono">
          tips.boilerhaus.org · built on Base
        </p>
      </div>
    </main>
  )
}
