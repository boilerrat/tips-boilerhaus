/**
 * Dynamic Open Graph image for /pay/[recipient].
 *
 * Generated at request time using Next.js ImageResponse (Satori).
 * Shows the creator display name (or truncated address) with the
 * boilerhaus tips branding so shared links look good on social.
 */

import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'Tip this creator on boilerhaus tips'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

interface OGImageProps {
  params: { recipient: string }
}

export default function OGImage({ params }: OGImageProps) {
  const recipient = decodeURIComponent(params.recipient)

  // Truncate raw addresses for display
  const displayName = recipient.startsWith('0x') && recipient.length === 42
    ? `${recipient.slice(0, 6)}...${recipient.slice(-4)}`
    : recipient

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#000000',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Subtle gradient background */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(ellipse at 50% 40%, rgba(251, 191, 36, 0.08) 0%, transparent 70%)',
          }}
        />

        {/* Brand dot */}
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            backgroundColor: '#fbbf24',
            marginBottom: 24,
          }}
        />

        {/* Heading */}
        <div
          style={{
            fontSize: 32,
            color: '#a1a1aa',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: 16,
          }}
        >
          Send a tip to
        </div>

        {/* Creator name */}
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: '#ffffff',
            maxWidth: '80%',
            textAlign: 'center',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {displayName}
        </div>

        {/* Footer */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 20,
            color: '#52525b',
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: '#fbbf24',
            }}
          />
          tips.boilerhaus.org
        </div>
      </div>
    ),
    { ...size },
  )
}
