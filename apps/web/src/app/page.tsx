/**
 * Landing page.
 *
 * Hero with value prop and a "pay someone" input to navigate to /pay/[recipient].
 * Wallet connection is handled by the Header component in the layout.
 */

'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()
  const [recipient, setRecipient] = useState('')

  const handleGo = useCallback(() => {
    const trimmed = recipient.trim()
    if (!trimmed) return
    router.push(`/pay/${encodeURIComponent(trimmed)}`)
  }, [recipient, router])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleGo()
    },
    [handleGo],
  )

  return (
    <main className="min-h-[calc(100vh-53px)] flex flex-col items-center justify-center px-4">
      <div className="max-w-lg w-full text-center space-y-10">
        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight">boilerhaus tips</h1>
          <p className="text-zinc-400 text-lg">
            Onchain creator support. One-time tips, subscriptions, and real-time streams.
          </p>
        </div>

        {/* Pay someone */}
        <div className="space-y-3">
          <label htmlFor="recipient-input" className="text-xs text-zinc-500 uppercase tracking-wide">
            Send a tip
          </label>
          <div className="flex gap-2">
            <input
              id="recipient-input"
              type="text"
              placeholder="ENS name or 0x address"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent border border-zinc-800 rounded px-4 py-3 text-sm font-mono text-white placeholder:text-zinc-700 focus:outline-none focus:border-zinc-600"
            />
            <button
              onClick={handleGo}
              disabled={!recipient.trim()}
              className="px-6 py-3 bg-white text-black font-semibold rounded hover:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Go
            </button>
          </div>
          <p className="text-zinc-700 text-xs font-mono">
            e.g. vitalik.eth or 0xd8dA...3E8
          </p>
        </div>

        <p className="text-zinc-700 text-xs font-mono">
          tips.boilerhaus.org &middot; built on Base
        </p>
      </div>
    </main>
  )
}
