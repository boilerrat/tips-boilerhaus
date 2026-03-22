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

interface PayPageProps {
  params: {
    recipient: string
  }
}

export default function PayPage({ params }: PayPageProps) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <p className="text-zinc-400 text-sm font-mono mb-1">sending to</p>
          <h2 className="text-2xl font-bold font-mono break-all">{params.recipient}</h2>
        </div>

        {/* Payment mode selector — placeholder for Phase 1 component */}
        <div className="border border-zinc-800 rounded-lg p-6 space-y-4">
          <p className="text-zinc-500 text-sm text-center">Payment UI coming soon.</p>
        </div>
      </div>
    </main>
  )
}

/**
 * Static params are not pre-generated — this page is fully dynamic.
 * ENS resolution and registry lookup happen at runtime.
 */
export const dynamic = 'force-dynamic'
