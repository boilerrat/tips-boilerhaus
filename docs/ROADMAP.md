# Roadmap — tips.boilerhaus.org

Last updated: 2026-03-23

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
- [ ] Creator metadata fetch hook (`useCreatorMetadata`) — resolve IPFS hash to JSON
- [ ] Creator profile display on `/pay/[recipient]` — avatar, name, bio, links
- [ ] Creator registration UI (`/creator/register`) — upload metadata to IPFS + call `register()`
- [ ] Creator profile edit UI (`/creator/edit`) — update metadata and tiers via `updateProfile()`
- [ ] Creator tiers — configurable suggested tip amounts stored in registry

---

## Phase 2C: Tip History & Creator Dashboard

_Give both sides visibility into what has happened._

- [ ] Choose event indexing strategy (direct RPC `getLogs` for MVP, migrate to subgraph later)
- [ ] `useTipHistory` hook — fetch `TipReceived` events for an address
- [ ] Tip history display on `/pay/[recipient]` — recent tips with amounts, messages, timestamps
- [ ] Creator dashboard page (`/creator/dashboard`) — incoming tips, total earned, profile management

---

## Phase 2D: Polish & Shareability

_Make the product shareable and usable in the real world._

- [ ] Payment mode selector component (tab UI for tip/subscription/stream — only tip active initially)
- [ ] OG image generation for `/pay/[recipient]` (dynamic via Next.js `opengraph-image`)
- [ ] Share button on creator pages (copy link, QR code)
- [ ] Mobile responsiveness audit
- [ ] Fix Header chain target to derive from `NEXT_PUBLIC_DEFAULT_CHAIN_ID`
- [ ] Custom token support — paste any ERC-20 address, fetch metadata on-chain

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
