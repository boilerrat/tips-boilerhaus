# Roadmap — tips.boilerhaus.org

Last updated: 2026-03-22

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

- [ ] Transaction receipt not reflecting in UI after tip sent (wagmi `useWaitForTransactionReceipt` issue with Privy embedded wallet — on-chain state is fine, UI doesn't flip to success)

---

## Phase 2: Token Support & Creator Profiles

- [ ] ERC-20 token selector in TipForm (USDC, DAI on Base)
- [ ] Token approval flow (approve → tip in one UX)
- [ ] Creator profile page — IPFS metadata display (name, bio, avatar, links)
- [ ] Creator registration UI — form to register/update profile on-chain
- [ ] Creator tiers — configurable suggested tip amounts stored in registry
- [ ] Tip history — index `TipSent` events, show recent tips on creator page

---

## Phase 3: Subscriptions

- [ ] `SubscriptionManager.sol` — recurring pull payments via token allowance
- [ ] Subscription UI — plan selection, approve allowance, manage active subs
- [ ] Subscription status display — active/expired/cancelled
- [ ] Renewal automation — keeper/bot to execute pulls on schedule
- [ ] Subscriber dashboard — list active subscriptions

---

## Phase 4: Streaming (Superfluid)

- [ ] Superfluid CFA integration — create/update/delete streams
- [ ] Stream UI — flow rate selector, real-time balance animation
- [ ] Stream management — sender can adjust or stop streams
- [ ] Creator stream dashboard — incoming streams, total flow rate
- [ ] Multi-token streams — support for Super Tokens on Base

---

## Phase 5: Production Hardening

- [ ] Mainnet deployment (Base L2)
- [ ] Production RPC configuration (Alchemy/Infura)
- [ ] Analytics — basic usage metrics
- [ ] Rate limiting on API routes
- [ ] Error monitoring (Sentry or similar)
- [ ] SEO — meta tags, OG images for creator pages
- [ ] Mobile responsiveness audit
- [ ] Accessibility audit (WCAG AA)
- [ ] Security audit of smart contracts

---

## Infrastructure Backlog

- [ ] GitHub Actions CI — lint, type-check, test on PR
- [ ] Automated deploy on merge to main
- [ ] Staging environment (separate subdomain)
- [ ] Database for off-chain data (tip messages, analytics) — if needed
- [ ] IPFS pinning service for creator metadata
