'use client'

import { IBM_Plex_Mono, Inter } from 'next/font/google'
import { PrivyProvider } from '@privy-io/react-auth'
import { WagmiProvider } from '@privy-io/wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { wagmiConfig } from '@/lib/wagmi'
import { env } from '@/env'
import { base, baseSepolia } from '@privy-io/chains'
import { Header } from '@/components/Header'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
})

// QueryClient lives outside the component to avoid re-creation on render
const queryClient = new QueryClient()

/**
 * Provider tree — only mounts Privy when a valid app ID is available.
 * During Next.js static page generation the env var is empty, so we
 * render a minimal shell to let the build succeed.
 */
function Providers({ children }: { children: React.ReactNode }) {
  if (!env.NEXT_PUBLIC_PRIVY_APP_ID) {
    // Build-time prerender: skip wallet/auth providers
    return <>{children}</>
  }

  return (
    <PrivyProvider
      appId={env.NEXT_PUBLIC_PRIVY_APP_ID}
      config={{
        appearance: {
          theme: 'dark',
          accentColor: '#ffffff',
        },
        defaultChain: baseSepolia,
        supportedChains: [base, baseSepolia],
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          {children}
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  )
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${ibmPlexMono.variable}`}>
      <body className="bg-black text-white font-sans antialiased">
        <Providers>
          {/* Header uses wagmi/Privy hooks — only render when providers are mounted */}
          {env.NEXT_PUBLIC_PRIVY_APP_ID && <Header />}
          {children}
        </Providers>
      </body>
    </html>
  )
}
