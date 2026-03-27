/**
 * Landing page.
 *
 * Hero with value prop and a "pay someone" input to navigate to /pay/[recipient].
 * Wallet connection is handled by the Header component in the layout.
 *
 * Palette: black bg, amber/gold brand accent, zinc neutrals
 * Fonts: Inter (UI), IBM Plex Mono (addresses, code)
 */

'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

const FEATURES = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    title: 'One-time tips',
    desc: 'Send ETH or tokens wallet to wallet on Base.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    title: 'Subscriptions',
    desc: 'Recurring support with token allowances.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    title: 'Real-time streams',
    desc: 'Continuous per-second flows via Superfluid.',
  },
] as const

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
    <main className="relative min-h-[calc(100vh-53px)] flex flex-col items-center justify-center px-4 overflow-hidden">
      {/* Background gradient orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-brand-500/[0.04] blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] rounded-full bg-brand-400/[0.03] blur-[100px]" />
      </div>

      <div className="relative max-w-xl w-full text-center space-y-12">
        {/* Hero */}
        <div className="space-y-5 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-800 bg-zinc-900/60 text-xs text-zinc-400 font-mono">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse-glow" />
            live on Base
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-[1.1]">
            Support creators<br />
            <span className="text-gradient">onchain</span>
          </h1>

          <p className="text-zinc-400 text-lg max-w-md mx-auto leading-relaxed">
            One-time tips, subscriptions, and real-time streams.
            Non-custodial. Wallet to wallet.
          </p>
        </div>

        {/* Search / pay input */}
        <div className="space-y-3 animate-slide-up" style={{ animationDelay: '0.15s', opacity: 0 }}>
          <label htmlFor="recipient-input" className="label">
            Send a tip
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                id="recipient-input"
                type="text"
                placeholder="ENS name or 0x address"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                onKeyDown={handleKeyDown}
                className="input-field !py-3.5 !text-sm font-mono pr-4"
              />
            </div>
            <button
              onClick={handleGo}
              disabled={!recipient.trim()}
              className="btn-primary !rounded-xl !px-8"
            >
              Go
            </button>
          </div>
          <p className="text-zinc-600 text-xs font-mono">
            e.g. vitalik.eth or 0xd8dA...3E8
          </p>
        </div>

        {/* Features */}
        <div
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-slide-up"
          style={{ animationDelay: '0.3s', opacity: 0 }}
        >
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="card-glass p-5 text-left space-y-2 hover:border-zinc-700 transition-colors duration-300"
            >
              <div className="text-brand-400">{f.icon}</div>
              <p className="text-sm font-semibold text-white">{f.title}</p>
              <p className="text-xs text-zinc-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <p
          className="text-zinc-700 text-xs font-mono animate-fade-in-slow"
          style={{ animationDelay: '0.5s', opacity: 0 }}
        >
          tips.boilerhaus.org &middot; built on Base
        </p>
      </div>
    </main>
  )
}
