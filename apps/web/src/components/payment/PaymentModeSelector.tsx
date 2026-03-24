/**
 * PaymentModeSelector — Tab UI for switching between payment modes.
 *
 * Currently only "Tip" is active. Subscription and Stream tabs are
 * shown as disabled placeholders with "Coming soon" badges,
 * signalling upcoming functionality.
 */

'use client'

import type { PaymentMode } from '@tips/shared'

interface PaymentModeSelectorProps {
  /** The currently selected payment mode. */
  selected: PaymentMode
  /** Called when the user selects a new mode. */
  onSelect: (mode: PaymentMode) => void
}

const MODES: readonly { mode: PaymentMode; label: string; enabled: boolean }[] = [
  { mode: 'tip', label: 'Tip', enabled: true },
  { mode: 'subscription', label: 'Subscribe', enabled: false },
  { mode: 'stream', label: 'Stream', enabled: false },
]

export function PaymentModeSelector({ selected, onSelect }: PaymentModeSelectorProps) {
  return (
    <div className="flex rounded-xl bg-zinc-900/60 border border-zinc-800 p-1">
      {MODES.map(({ mode, label, enabled }) => {
        const isSelected = mode === selected
        return (
          <button
            key={mode}
            onClick={() => enabled && onSelect(mode)}
            disabled={!enabled}
            className={`
              relative flex-1 px-3 py-2 text-sm font-medium rounded-lg
              transition-all duration-200
              ${isSelected
                ? 'bg-zinc-800 text-white shadow-sm'
                : enabled
                  ? 'text-zinc-500 hover:text-zinc-300'
                  : 'text-zinc-700 cursor-not-allowed'
              }
            `}
          >
            {label}
            {!enabled && (
              <span className="absolute -top-1.5 -right-1 px-1 py-0.5 text-[9px] font-mono leading-none rounded bg-zinc-800 text-zinc-600 border border-zinc-700">
                soon
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
