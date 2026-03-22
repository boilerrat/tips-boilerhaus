import { ConnectButton } from '@rainbow-me/rainbowkit'

/**
 * Landing page.
 *
 * Phase 1: Simple placeholder with wallet connect.
 * Later: Creator directory, featured profiles, protocol stats.
 */
export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-lg w-full text-center space-y-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">boilerhaus tips</h1>
          <p className="text-zinc-400 text-lg">
            Onchain creator support. One-time tips, subscriptions, and real-time streams.
          </p>
        </div>

        <ConnectButton />

        <p className="text-zinc-600 text-sm font-mono">
          tips.boilerhaus.org · built on Base
        </p>
      </div>
    </main>
  )
}
