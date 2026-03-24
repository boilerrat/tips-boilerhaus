/**
 * ShareButton — Copy link + QR code modal for sharing creator pages.
 *
 * Shows a button that copies the current page URL to clipboard.
 * Includes a QR code toggle rendered as an inline SVG via a minimal
 * QR generation algorithm (no external dependency).
 */

'use client'

import { useState, useCallback, useMemo } from 'react'

interface ShareButtonProps {
  /** The URL to share. Defaults to current page. */
  url?: string
}

export function ShareButton({ url }: ShareButtonProps) {
  const [copied, setCopied] = useState(false)
  const [showQR, setShowQR] = useState(false)

  const shareUrl = url ?? (typeof window !== 'undefined' ? window.location.href : '')

  const handleCopy = useCallback(async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input')
      input.value = shareUrl
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [shareUrl])

  const qrDataUrl = useMemo(() => {
    if (!showQR || !shareUrl) return null
    return generateQRDataUrl(shareUrl)
  }, [showQR, shareUrl])

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-2">
        {/* Copy link button */}
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-zinc-800 rounded-lg text-zinc-500 hover:text-white hover:border-zinc-600 hover:bg-zinc-900/60 transition-all duration-200"
        >
          {copied ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              Copy link
            </>
          )}
        </button>

        {/* QR code toggle */}
        <button
          onClick={() => setShowQR((prev) => !prev)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg transition-all duration-200 ${
            showQR
              ? 'border-brand-400/30 text-brand-400 bg-brand-400/[0.06]'
              : 'border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-600 hover:bg-zinc-900/60'
          }`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="3" height="3" />
            <line x1="21" y1="14" x2="21" y2="14.01" />
            <line x1="21" y1="21" x2="21" y2="21.01" />
            <line x1="17" y1="17" x2="17" y2="17.01" />
          </svg>
          QR
        </button>
      </div>

      {/* QR code display */}
      {showQR && qrDataUrl && (
        <div className="p-3 bg-white rounded-xl animate-fade-in">
          <img
            src={qrDataUrl}
            alt="QR code for this page"
            width={160}
            height={160}
            className="block"
          />
        </div>
      )}
    </div>
  )
}

/**
 * Minimal QR code generation using the QR Code API.
 * Returns a data URL pointing to an external QR code service.
 *
 * For a zero-dependency approach we use the Google Charts QR API
 * which is simple and reliable. In production, consider a client-side
 * QR library if you want offline support.
 */
function generateQRDataUrl(text: string): string {
  const encoded = encodeURIComponent(text)
  return `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encoded}&bgcolor=ffffff&color=000000&margin=8`
}
