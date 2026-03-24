# Roadmap — tips.boilerhaus.org

Last updated: 2026-03-24

---

## Phase 0: Scaffold & Infrastructure

- [x] Monorepo setup (Turborepo, pnpm workspaces, tsconfig, Prettier)
- [x] `apps/web` — Next.js 14 app with App Router, Tailwind, layout
- [x] `packages/shared` — Domain type definitions (Tip, Subscription, Stream modes)
- [x] `packages/contracts` — Package structure + `foundry.toml`
- [x] `infra/docker` — Dockerfile.web + docker-compose.yml
- [x] `infra/traefik` — Dynamic config for subdomain routing
- [x] `.github/workflows/ci.yml` — CI/CD pipeline
- [x] `docs/` — Architecture and development documentation

---

## Phase 1: Core Tipping (ETH)

### Frontend

- [x] Landing page (`/`) — hero, recipient input, feature cards
- [x] Pay page (`/pay/[recipient]`) — recipient resolution + tip form
- [x] `TipForm` component — amount input, presets, message, tx status
- [x] `Header` component — sticky nav, wallet connect, chain status
- [x] Frontend design system — brand colors, component classes, animations
- [x] Privy wallet integration (connect, sign, embedded wallets)
- [x] wagmi v2 + viem chain configuration (Base, Base Sepolia, mainnet for ENS)

### Hooks

- [x] `useResolveRecipient` — ENS ↔ address resolution via mainnet
- [x] `useCreatorProfile` — Read creator profile from registry (graceful fallback when unregistered)

### Environment & Build

- [x] `env.ts` — Zod-validated env vars with `safeParse()` for build safety
- [x] Privy provider guard — skip during static page generation
- [x] `.env.example` — documented env var template
- [x] Docker build fix — correct env var names (Privy, not WalletConnect)
- [x] `apps/web/public/.gitkeep` — directory exists for Docker COPY

### Deployment

- [x] Dockerfile.web — multi-stage build (deps → builder → runner)
- [x] docker-compose.yml — Traefik labels, health check, network config
- [x] **Dokploy deployment** — configure build env vars, verify live at tips.boilerhaus.org
- [x] **SSL verification** — confirm Let's Encrypt cert via Traefik

### Contracts

- [x] **`CreatorRegistry.sol`** — minimal registry mapping addresses to IPFS metadata hashes, events on register/update
- [x] **Foundry tests** for CreatorRegistry
- [x] **`Deploy.s.sol`** — Foundry deployment script for Base Sepolia
- [x] **Deploy to Base Sepolia** — contract at `0xd984470D4D1dC129e165a6716d9B20F0A6D72A08`, verified on Blockscout

### Known Issues

- [x] Transaction receipt not reflecting in UI after tip sent (wagmi `useWaitForTransactionReceipt` issue with Privy embedded wallet — on-chain state is fine, UI doesn't flip to success)

---

## Phase 2A: Token Support (COMPLETE)

_ERC-20 payment mechanics — select token, approve, tip._

- [x] ERC-20 token selector in TipForm (USDC, DAI on Base)
- [x] Token approval flow (approve → tip in one UX)

---

## Phase 2B: Creator Identity

_Complete the creator side so pages have identity beyond a raw address._

- [x] IPFS pinning service integration (Pinata via `pinata` SDK)
- [x] Creator metadata fetch hook (`useCreatorMetadata`) — resolve IPFS hash to JSON
- [x] Creator profile display on `/pay/[recipient]` — avatar, name, bio, links
- [x] Creator registration UI (`/creator/register`) — upload metadata to IPFS + call `register()`
- [x] Creator profile edit UI (`/creator/edit`) — update metadata and tiers via `updateProfile()`
- [x] Creator tiers — configurable suggested tip amounts stored in registry

---

## Phase 2C: Tip History & Creator Dashboard (COMPLETE)

_Give both sides visibility into what has happened._

- [x] Choose event indexing strategy (direct RPC `getLogs` for MVP, migrate to subgraph later)
- [x] `useTipHistory` hook — fetch `TipReceived` events for an address
- [x] Tip history display on `/pay/[recipient]` — recent tips with amounts, messages, timestamps
- [x] Creator dashboard page (`/creator/dashboard`) — incoming tips, total earned, profile management

---

## Phase 2D: Polish & Shareability (COMPLETE)

_Make the product shareable and usable in the real world._

- [x] Payment mode selector component (tab UI for tip/subscription/stream — only tip active initially)
- [x] OG image generation for `/pay/[recipient]` (dynamic via Next.js `opengraph-image`)
- [x] Share button on creator pages (copy link, QR code)
- [x] Mobile responsiveness audit
- [x] Fix Header chain target to derive from `NEXT_PUBLIC_DEFAULT_CHAIN_ID`
- [x] Custom token support — paste any ERC-20 address, fetch metadata on-chain

---

## Phase 2E: Fiat On-Ramp (Coinbase Onramp)

_Enable non-crypto users to fund their wallets and tip using a bank card.
Uses Coinbase Onramp (`@coinbase/cbpay-js`) — zero fees for USDC on Base.
Users go through Coinbase's hosted KYC flow; no PII touches our app._

### Setup

- [x] Create CDP (Coinbase Developer Platform) account at portal.cdp.coinbase.com
- [x] Obtain Onramp API credentials (Secret API Key for session tokens)
- [x] Add `COINBASE_ONRAMP_API_KEY` and `COINBASE_ONRAMP_API_SECRET` to env vars (`.env.example`, `env.ts`, CI)

### Backend

- [x] API route (`/api/onramp/session`) — generate Coinbase Onramp session token server-side
- [x] Validate wallet address param before forwarding to Coinbase

### Frontend

- [x] Install `@coinbase/cbpay-js`
- [x] `useCoinbaseOnramp` hook — initialize and trigger the Onramp popup
- [x] "Add Funds" button on `/pay/[recipient]` — shown when sender wallet has insufficient balance
- [x] Insufficient balance detection — compare wallet balance to tip amount, prompt on-ramp if short
- [x] Post-purchase balance refresh — poll or listen for balance update after Onramp popup closes
- [x] Default to USDC on Base in the Onramp widget params

### UX Polish

- [x] Empty wallet first-visit flow — guide new Privy email users through funding before first tip
- [x] Loading/pending state while Coinbase processes the purchase
- [x] Error handling for Onramp failures (KYC rejected, payment failed, popup blocked)

---

## Phase 2F: Gas Sponsorship (Coinbase Paymaster) — Deferred

_Sponsor gas fees so users only need USDC, not ETH. Requires migrating from
EOA wallets to ERC-4337 smart accounts. Deferred until after mainnet launch
(Phase 5A) since Base gas is already fractions of a cent._

_Prerequisites: Coinbase CDP account, Privy smart wallet configuration,
paymaster proxy endpoint._

- [ ] Evaluate Privy smart wallet migration path (EOA → smart accounts)
- [ ] Document address migration plan for existing registered creators
- [ ] Configure Coinbase Paymaster URL in Privy dashboard
- [ ] Backend proxy to protect paymaster endpoint from abuse
- [ ] Set per-user and global sponsorship limits
- [ ] Test gas-sponsored tip flow end-to-end on Base Sepolia
- [ ] Apply for Base Gasless Campaign credits ($15K free gas)

---

## Phase 3: Streaming (Superfluid)

_Per-second token streams via Superfluid CFA. High wow-factor, lower complexity
than subscriptions — Superfluid contracts already exist on Base, this is
primarily a frontend integration._

- [ ] Superfluid SDK integration (`@superfluid-finance/sdk-core`)
- [ ] Super Token wrapping UI (USDC → USDCx, ETH → ETHx)
- [ ] Stream creation flow — select flow rate, create CFA via Superfluid Forwarder
- [ ] Stream management — sender can update rate or cancel
- [ ] Real-time balance animation (streaming counter)
- [ ] Creator stream dashboard — incoming streams, aggregate flow rate
- [ ] Multi-token streams — support for Super Tokens on Base

---

## Phase 4: Subscriptions

_Recurring pull payments. Highest complexity — requires a new contract, design
decisions (pull-payment vs Sablier v2), and off-chain keeper automation that
does not exist in the stack today._

- [ ] Subscription design document (pull-payment vs Sablier, automation strategy, cancellation UX)
- [ ] `SubscriptionManager.sol` — contract for managing subscription state and pulls
- [ ] Foundry tests for SubscriptionManager
- [ ] Deploy SubscriptionManager to Base Sepolia
- [ ] Subscription UI — plan selection, approve allowance, manage active subs
- [ ] Renewal automation via Gelato Automate or Chainlink Automation
- [ ] Subscription status display (active/expired/cancelled)
- [ ] Subscriber dashboard — list active subscriptions with cancel ability

---

## Phase 5A: Mainnet & Monitoring

_Ship as soon as Phase 2D is complete — these are prerequisites for real usage,
not "hardening."_

- [ ] Deploy CreatorRegistry to Base mainnet
- [ ] Production RPC configuration (Alchemy/Infura with proper rate limits)
- [ ] Error monitoring (Sentry)
- [ ] Basic analytics (PostHog, Plausible, or similar)

---

## Phase 5B: Hardening

- [ ] Rate limiting on API routes
- [ ] Accessibility audit (WCAG AA)
- [ ] Security audit of smart contracts
- [ ] Performance audit (bundle size, LCP, CLS)
- [ ] Frontend test infrastructure (Vitest + Testing Library)
- [ ] Unit tests for hooks (`useResolveRecipient`, `useCreatorProfile`, `useTipHistory`)
- [ ] Integration tests for payment flows

---

## Infrastructure Backlog

- [x] GitHub Actions CI — lint, type-check, test on PR _(configured in ci.yml)_
- [x] Automated deploy on merge to main _(configured in ci.yml via Dokploy)_
- [ ] Staging environment (separate subdomain, Base Sepolia target)
- [x] IPFS pinning service account and API key _(Pinata — prerequisite for Phase 2B)_
- [ ] Event indexer migration (The Graph or Ponder — when `getLogs` stops scaling)
- [ ] Database for off-chain data (tip messages, analytics) — if needed
- [ ] Clean up docs referencing RainbowKit — code uses Privy
