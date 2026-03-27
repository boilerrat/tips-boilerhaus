# CLAUDE.md — Boilerhaus Tips

You are working on **tips-boilerhaus**, a crypto-native creator funding protocol
deployed at `tips.boilerhaus.org`. This file is your primary orientation document.
Read it fully before touching any code.

---

## What This Project Is

A non-custodial creator tipping protocol built on Base. It supports three payment modes:

- **Tip** — one-time ETH or ERC-20 transfer directly to a recipient address
- **Subscription** — recurring periodic pull against a pre-approved token allowance _(Phase 4 — complete)_
- **Stream** — continuous per-second token flow via Superfluid CFA _(Phase 3 — complete)_

No funds are ever custodied by the protocol. All value flows wallet-to-wallet.
Creator pages are served at `/pay/[recipient]` where recipient is an ENS name or raw address.

---

## Monorepo Structure

```
apps/web/                       Next.js 14 frontend (tips.boilerhaus.org)
  src/
    app/                        App Router pages
      page.tsx                  Landing page (/)
      layout.tsx                Root layout — Privy/wagmi/TanStack providers
      creator/
        register/page.tsx       Creator registration form
        edit/page.tsx           Creator profile editing
        dashboard/page.tsx      Creator dashboard (earnings, streams, subscriptions, tips)
      subscriber/
        dashboard/page.tsx      Subscriber dashboard (active subs, cancel ability)
      pay/[recipient]/
        page.tsx                Recipient payment page (tip + subscribe + stream UI)
        opengraph-image.tsx     Dynamic OG image generation
      api/
        onramp/session/route.ts Coinbase Onramp session token endpoint
        ipfs/pin/route.ts       IPFS pinning endpoint (Pinata)
    components/
      Header.tsx                Sticky nav with wallet connect, chain status
      ShareButton.tsx           Copy link + QR code sharing
      creator/
        CreatorProfileForm.tsx  Shared form for register/edit flows
      payment/
        TipForm.tsx             One-time tip form (ETH + ERC-20)
        SubscribeForm.tsx       Subscription form (approve allowance + subscribe)
        SubscriptionDashboard.tsx Creator's incoming subscriptions view
        StreamForm.tsx          Superfluid stream creation/management
        StreamDashboard.tsx     Creator's incoming streams view
        StreamingCounter.tsx    Animated real-time balance ticker
        TipHistory.tsx          Recent tips list (event-indexed)
        PaymentModeSelector.tsx Tab UI (Tip | Subscribe | Stream) — all enabled
        FundWalletBanner.tsx    Coinbase Onramp prompt for empty wallets
    hooks/
      useResolveRecipient.ts   ENS <-> address resolution (mainnet)
      useCreatorProfile.ts     Read creator from on-chain registry
      useCreatorMetadata.ts    Fetch IPFS metadata JSON from CID
      useTipHistory.ts         Fetch TipReceived events via getLogs
      useTokenMetadata.ts      Fetch ERC-20 metadata for custom tokens
      useCoinbaseOnramp.ts     Coinbase Onramp popup flow
      useSubscription.ts       Subscribe, cancel, allowance, existing sub detection,
                               creator/subscriber subscription lists, status helpers
      useWrapSuperToken.ts     ERC-20 -> Super Token wrapping
      useStreamFlow.ts         Create/update/cancel Superfluid streams
      useStreams.ts             Query Superfluid subgraph for active streams
      useRealtimeBalance.ts    Animated balance with per-second extrapolation
    lib/
      wagmi.ts                 Chain config (Base, Base Sepolia, mainnet for ENS)
      contracts.ts             CreatorRegistry + SubscriptionManager ABIs + addresses
      tokens.ts                ERC-20 token configs per chain (USDC, DAI)
      superfluid.ts            Super Token configs, flow rate helpers, subgraph URLs
      ipfs.ts                  CID -> HTTP gateway URL conversion
    env.ts                     Zod-validated environment variables
packages/contracts/             Solidity contracts — Foundry toolchain
  src/CreatorRegistry.sol       On-chain registry + tip routing
  src/SubscriptionManager.sol   Subscription lifecycle (subscribe/cancel/renew)
  test/CreatorRegistry.t.sol    Foundry unit tests
  test/SubscriptionManager.t.sol Subscription contract tests
  test/mocks/MockERC20.sol      Test helper
  scripts/Deploy.s.sol          Deployment script
  foundry.toml                  Compiler config (solc 0.8.24, paris EVM, optimizer 200)
packages/keeper/                Subscription renewal keeper service
  src/index.ts                  Entry point — periodic sweep loop
  src/keeper.ts                 Sweep logic — iterate subs, call processRenewal()
  src/config.ts                 Env-based configuration (private key, RPC, interval)
  src/abi.ts                    Minimal SubscriptionManager ABI for keeper
packages/shared/                Shared TypeScript domain types
  src/types.ts                  PaymentMode, TipPayment, StreamPayment, SubscriptionPayment,
                                CreatorProfile, CreatorMetadata, PaymentTier
infra/docker/                   Dockerfile.web + Dockerfile.keeper + docker-compose.yml
infra/traefik/                  Traefik dynamic config for subdomain routing
docs/                           Architecture and development documentation
  ROADMAP.md                    Phased plan with checkboxes
.github/workflows/ci.yml        CI/CD pipeline (GitHub Actions)
```

---

## Tech Stack

| Concern | Choice |
|---|---|
| Frontend framework | Next.js 14, App Router, TypeScript |
| Wallet / auth | Privy (`@privy-io/react-auth` v3, embedded + external wallets) |
| Chain interaction | wagmi v2 (`@privy-io/wagmi`), viem |
| Streaming | Superfluid Protocol via `@sfpro/sdk` (CFA, Super Tokens) |
| Fiat on-ramp | Coinbase Onramp (`@coinbase/cbpay-js`, CDP JWT auth) |
| Contracts | Solidity 0.8.24, Foundry (forge, cast), OpenZeppelin |
| Styling | Tailwind CSS 3, IBM Plex Mono + Inter fonts |
| IPFS | Pinata (`pinata` SDK v2) for pinning, public/dedicated gateway for reads |
| Package manager | pnpm 9 (workspaces) |
| Build orchestration | Turborepo |
| Deployment | Docker standalone, Traefik, OVH VPS via Dokploy |
| CI/CD | GitHub Actions -> GHCR -> Dokploy |
| Primary chain | Base mainnet (8453), Base Sepolia (84532) for dev |
| Async state | TanStack Query v5 |
| Subscription keeper | Node.js + viem (standalone service, `packages/keeper`) |
| Validation | Zod (env vars, API request bodies) |

---

## Completed Phases (0-4)

These phases are done. Reference them for patterns, don't rebuild them.

### Phase 0: Scaffold & Infrastructure
Monorepo setup, Docker, Traefik, CI/CD, docs.

### Phase 1: Core Tipping (ETH)
Landing page, `/pay/[recipient]`, TipForm, Privy wallet integration,
wagmi chain config, ENS resolution, CreatorRegistry contract (deployed to
Base Sepolia v2 at `0xd9e883c4a8340fF4138d4fE229B05445fAaE0971`).

### Phase 2A-2E: Token Support, Creator Identity, History, Polish, Fiat On-Ramp
ERC-20 tipping (USDC, DAI on Base), IPFS creator profiles (Pinata),
tip history via `getLogs`, OG images, share button, mobile responsive,
custom token support, Coinbase Onramp for non-crypto users.

### Phase 3: Streaming (Superfluid)
Per-second streams via CFAv1Forwarder (`setFlowrate` handles create/update/delete).
Super Token wrapping (approve+upgrade for ERC-20, upgradeByETH for native ETH),
real-time balance animation, creator stream dashboard, multi-token (ETHx, USDCx, DAIx).

### Phase 4: Subscriptions (complete)
Pull-payment model via SubscriptionManager.sol (deployed + verified on Base Sepolia
at `0xD77A14d390F6BC08F6aB720787c046F8b2850114`). Full lifecycle: subscribe (first
payment pulled immediately), cancel, update (pending plan changes applied at renewal).
Keeper service (`packages/keeper`) polls and calls `processRenewal()` for due subs.
Subscription status display (active/overdue/cancelled) on creator dashboard.
Subscriber dashboard at `/subscriber/dashboard` with cancel ability.
"My Subs" nav link in Header for all authenticated users.

---

## Remaining Phases

### Phase 5A: Mainnet & Monitoring
Deploy to Base mainnet, production RPC, Sentry, analytics.

### Phase 5B: Hardening
Rate limiting, accessibility, security audit, perf audit, test infrastructure.

### Phase 2F: Gas Sponsorship _(deferred)_
Requires EOA -> ERC-4337 smart account migration. Deferred since Base gas is
already fractions of a cent.

---

## Existing Contracts & On-Chain Architecture

### CreatorRegistry.sol (deployed)
- **Address (Base mainnet):** `0x5fb3bBEE3AB0B21c21126C66d9bba424F2ff44ef` (feeBps=100, feeRecipient=Safe)
- **Address (Base Sepolia):** `0xd9e883c4a8340fF4138d4fE229B05445fAaE0971` (feeBps=0)
- **Functions:** `register()`, `updateProfile()`, `deactivate()`, `reactivate()`,
  `getCreator()`, `tip()`
- **Events:** `CreatorRegistered`, `CreatorUpdated`, `CreatorDeactivated`,
  `CreatorReactivated`, `TipReceived`
- **Security:** ReentrancyGuard, SafeERC20, immutable `feeBps`/`feeRecipient`,
  zero-address checks, MAX_TIERS (20), CEI pattern
- **Key design:** `tip()` does NOT require registration — anyone can receive.
  Protocol fee (basis points) is set at deploy and immutable.
  `address(0)` = native ETH.
- **PaymentMode enum:** `TIP=0, SUBSCRIPTION=1, STREAM=2` (on-chain, maps to
  the `PaymentTier.mode` field)

### SubscriptionManager.sol (deployed)
- **Address (Base mainnet):** `0x1F81679cdcb90dF123a2938192ee114086170E66` (feeBps=100, feeRecipient=Safe)
- **Address (Base Sepolia):** `0xD77A14d390F6BC08F6aB720787c046F8b2850114` (feeBps=0)
- **Functions:** `subscribe(creator, token, amountPerPeriod, periodSeconds)`,
  `cancel(subscriptionId)`, `updateSubscription(subscriptionId, newAmount, newPeriod)`,
  `processRenewal(subscriptionId)`, `getSubscription(id)`,
  `getSubscriptionsBySubscriber(addr)`, `getSubscriptionsByCreator(addr)`
- **Events:** `SubscriptionCreated`, `SubscriptionRenewed`, `SubscriptionUpdated`,
  `SubscriptionCancelled`
- **Constraints:** MIN_PERIOD=86400 (1 day), MAX_PERIOD=31536000 (365 days),
  ERC-20 only (no native ETH — `token != address(0)`)
- **Key design:** First payment pulled immediately in `subscribe()`. Renewals
  pulled by keeper via `processRenewal()` after `nextPaymentTimestamp` passes.
  Subscriber must maintain sufficient ERC-20 allowance on this contract.
- **Env var:** `NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS`
- **ABI:** Full ABI in `apps/web/src/lib/contracts.ts` as `subscriptionManagerAbi`

### Superfluid (external, no custom contracts)
- **CFAv1Forwarder:** Canonical singleton at `0xcfA132E353cB4E398080B9700609bb008eceB125`
  (same on all chains). Uses `setFlowrate(token, receiver, flowrate)`.
- **Token addresses:** See `apps/web/src/lib/superfluid.ts` (Super Tokens) and
  `apps/web/src/lib/tokens.ts` (ERC-20s) — code is the source of truth.
- **Buffer deposit:** ~4 hours of streaming locked when opening a stream
- **SDK:** `@sfpro/sdk` (devDependency, provides typed ABIs + chain-indexed addresses)

---

## Coding Standards

### General

- TypeScript everywhere. No `any`. No implicit `any`. Strict mode is on.
- `tsconfig.json` target is `ES2022` (BigInt literals `0n` are used throughout).
- Every new file gets a brief JSDoc block at the top explaining its purpose.
- Comment non-obvious decisions inline — especially anything crypto or contract-related.
- Use `zod` for any runtime validation. The env module pattern in `apps/web/src/env.ts`
  is the established precedent — follow it for any new validated config.

### File and Module Conventions

- Path alias `@/*` maps to `apps/web/src/*` — use it, don't use relative `../../` chains.
- Domain types live in `packages/shared/src/types.ts`. Add to it rather than
  defining local types that duplicate shared concepts.
- Wallet address types are always `0x${string}` (viem's type), never plain `string`.
- Token amounts are always `bigint` in wei — never `number`, never string-formatted amounts
  in business logic. Format only at the display layer.
- Contract ABIs live in `apps/web/src/lib/contracts.ts` (our contracts) or are
  imported from `@sfpro/sdk/abi` (Superfluid ABIs). Keep ABI sources centralized.
- Token configs per chain live in `apps/web/src/lib/tokens.ts` (for tipping) and
  `apps/web/src/lib/superfluid.ts` (for streaming Super Tokens).
- When adding a new lib module, follow the existing pattern: JSDoc header,
  chain-indexed config objects, and helper functions.

### React / Next.js Patterns (established)

- App Router only. No Pages Router patterns.
- Server Components by default. Add `'use client'` only when genuinely needed
  (wallet hooks, interactive state, Privy components).
- wagmi hooks (`useReadContract`, `useWriteContract`, `useWaitForTransactionReceipt`)
  are the correct way to interact with contracts from the frontend — not direct
  viem calls in components.
- TanStack Query manages all async state. Do not use `useEffect` + `useState` for
  data fetching.
- Privy is the wallet provider (not RainbowKit). `@privy-io/wagmi` wraps wagmi
  config creation.
- Provider tree order: `PrivyProvider` > `QueryClientProvider` > `WagmiProvider`.
- Layout guards: `{env.NEXT_PUBLIC_PRIVY_APP_ID && <Header />}` pattern prevents
  crashes during static page generation.

### Component Patterns (follow these for consistency)

- **Payment forms** (TipForm, StreamForm): Multi-step state machine
  (`idle` -> `approving` -> `confirming` -> `success`). Use `useWriteContract` +
  `useWaitForTransactionReceipt` for tx lifecycle. Show tx hash link to
  Blockscout/Basescan on success.
- **Token selectors:** Dropdown from chain-specific config. Support custom
  ERC-20 paste via `useTokenMetadata` for validation.
- **Loading states:** Spinner with `border-t-brand-400` animation. Consistent
  across all components.
- **Error display:** Red accent (`red-400`/`red-950`) with icon and message.
- **Card containers:** Use `card-elevated` class for glass-morphism cards.
- **Labels:** Use `label` class for section headers.
- **Buttons:** `btn-primary` (brand accent) and `btn-secondary` (zinc outline).
- **Dashboard sections:** Card with `<p className="label mb-3">Section name</p>` header.

### Hook Patterns (follow these for new hooks)

- Each hook file has a JSDoc header explaining purpose.
- Hooks that read contract state use `useReadContract` with proper `enabled` guards.
- Hooks that write use `useWriteContract` + `useWaitForTransactionReceipt`.
- Hooks that query external APIs (subgraph, IPFS) use TanStack Query directly
  (`useQuery`) with appropriate `refetchInterval` and `enabled` conditions.
- Export a descriptive return type (e.g., `{ tips, isLoading, error }`).
- Use `readonly` arrays in return types where mutation isn't needed.

### Contracts

- Solidity 0.8.24. NatSpec on all public/external functions.
- Foundry config in `packages/contracts/foundry.toml`: EVM `paris`, optimizer 200 runs.
- No upgradeable proxy patterns unless explicitly requested — keep contracts simple.
- Every state-changing function emits an event. The frontend indexes events; silent
  state changes break the UI.
- Write Foundry tests alongside every new contract. Unit tests in `packages/contracts/test/`,
  deployment scripts in `packages/contracts/scripts/`.
- Never hardcode addresses — pass them as constructor args or read from a config.
- OpenZeppelin imports use `@openzeppelin/` remapping -> `lib/openzeppelin-contracts/`.

---

## Workflow Rules — Read These Carefully

### Issue-First

**Do not write code without an issue to reference.** If a task doesn't have an issue,
create one first. The issue is the decision record; the PR is the execution record.

### PR Discipline

Every PR must state:
1. **Scope** — which lanes are touched (`apps/`, `packages/`, `infra/`) and why
2. **Risk** — blast radius, rollback complexity, any infra or data side effects
3. **Validation** — how to verify the change works
4. **Rollback** — explicit steps to revert post-merge if needed

### Lane Boundaries

A PR should touch one primary lane. Cross-lane changes (e.g. a `packages/shared`
type change consumed by `apps/web`) should be split into sequential PRs:
land the package change first, then the consumer.

### Confirmation Before Implementation

During planning or design phases, stay in discussion mode. Do not open PRs,
push branches, or create issues without explicit instruction. When in doubt, ask:
"Ready to implement?"

---

## Environment Variables

All vars are documented in `.env.example` at the repo root.
The validation module at `apps/web/src/env.ts` is the single source of truth
for which vars the app requires. If you add a new env var:

1. Add it to `.env.example` with a comment explaining its purpose
2. Add it to the zod schema in `apps/web/src/env.ts`
3. Add it to the `build-args` section of `.github/workflows/ci.yml`
4. Document it in `docs/development.md`

`NEXT_PUBLIC_*` vars are baked at build time — a change requires a rebuild.

### Current env vars:
| Variable | Side | Purpose |
|---|---|---|
| `NEXT_PUBLIC_PRIVY_APP_ID` | Client | Privy app identifier |
| `NEXT_PUBLIC_DEFAULT_CHAIN_ID` | Client | Target chain (8453 or 84532) |
| `NEXT_PUBLIC_REGISTRY_CONTRACT_ADDRESS` | Client | CreatorRegistry contract address |
| `NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS` | Client | SubscriptionManager contract address |
| `NEXT_PUBLIC_BASE_RPC_URL` | Client | Base mainnet RPC |
| `NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL` | Client | Base Sepolia RPC |
| `NEXT_PUBLIC_PINATA_GATEWAY_URL` | Client | Pinata dedicated IPFS gateway |
| `PINATA_JWT` | Server | Pinata API key for IPFS pinning |
| `COINBASE_ONRAMP_API_KEY` | Server | CDP API key name |
| `COINBASE_ONRAMP_API_SECRET` | Server | CDP EC private key (PEM) |
| `KEEPER_PRIVATE_KEY` | Keeper | 0x-prefixed private key for renewal tx gas |
| `KEEPER_RPC_URL` | Keeper | RPC endpoint (defaults to Base Sepolia RPC) |
| `KEEPER_INTERVAL_MS` | Keeper | Sweep interval in ms (default: 60000) |
| `KEEPER_HEALTH_PORT` | Keeper | Health endpoint port (default: 8080) |
| `NEXT_PUBLIC_SENTRY_DSN` | Client | Sentry DSN for error monitoring |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | Client | Plausible analytics domain |
| `NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL` | Client | Custom Plausible script URL (self-hosted) |

---

## Infrastructure Context

The app runs on an OVH VPS at `boilerhaus.org` managed by Dokploy with Traefik
as the reverse proxy. Dokploy builds images directly from the GitHub repo —
it clones the repo and runs `docker build` using `infra/docker/Dockerfile.web`.
SSL is handled by Traefik via Let's Encrypt — do not manage certs manually.

The CI pipeline in `.github/workflows/ci.yml` also builds and pushes to GHCR,
but the production deploy is triggered from Dokploy, not CI.

The subscription keeper runs as a separate Docker service (`keeper` in
`docker-compose.yml`, built from `infra/docker/Dockerfile.keeper`). It needs
a funded wallet (`KEEPER_PRIVATE_KEY`) to pay gas for `processRenewal()` calls.
On Base, gas is fractions of a cent, so the keeper wallet needs minimal ETH.
The keeper exposes an HTTP health endpoint on port 8080 (`/health`) for Docker
health checks and external monitoring.

### Monitoring Stack

- **Sentry** (`@sentry/nextjs`) — error tracking + performance monitoring.
  Configured via `NEXT_PUBLIC_SENTRY_DSN`. Includes client, server, and edge
  configs, instrumentation hook, and global error boundary. The `/monitoring`
  tunnel route proxies browser events to avoid ad-blockers.
- **Plausible Analytics** — privacy-focused, cookie-free page analytics.
  Configured via `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`. Supports Plausible Cloud
  (default) or self-hosted instances (`NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL`).
- **Keeper health** — HTTP endpoint at `/health` (port 8080) returns JSON
  with sweep stats, consecutive failures, and uptime. Docker health check
  monitors this endpoint. Returns 503 after 5 consecutive sweep failures.

### Deployment Pitfalls — Lessons Learned

The following issues caused persistent **Bad Gateway** errors after initial deployment.
All must be correct for the container to pass health checks and serve traffic.

#### 1. Standalone output paths in a pnpm monorepo

When `outputFileTracingRoot` in `next.config.js` points to the monorepo root
(two levels up), Next.js standalone output mirrors the full directory structure.
The server entrypoint lands at `apps/web/server.js` inside the standalone folder,
**not** at the root. All Dockerfile COPY and CMD paths must account for this:

```dockerfile
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
CMD ["node", "apps/web/server.js"]
```

#### 2. Health check must use 127.0.0.1, not localhost

Alpine's busybox `wget` resolves `localhost` to `::1` (IPv6), but the Next.js
standalone server binds to `0.0.0.0` (IPv4 only). Use `127.0.0.1` explicitly.

#### 3. Guard client-only providers during static page generation

Components using wagmi/Privy hooks cannot render during static generation when
`NEXT_PUBLIC_PRIVY_APP_ID` is empty. The established pattern:

```tsx
{env.NEXT_PUBLIC_PRIVY_APP_ID && <Header />}
```

#### 4. PostCSS config required for Tailwind in monorepo apps

`apps/web/postcss.config.js` must exist with `tailwindcss` and `autoprefixer`
plugins. Without it, Tailwind classes aren't generated in production builds.

#### 5. Contract verification on Blockscout requires correct EVM version

`evm_version = "paris"` is pinned in `foundry.toml`. Use the Blockscout v1 API
with `codeformat=solidity-single-file` and `forge flatten` for reliable verification.
See `docs/` for the full curl command.

---

## Key Design Decisions (non-obvious, not derivable from code)

- **Subscription: Pull-payment model** chosen over Sablier v2. Simpler, more
  flexible, gives subscribers full control of their allowance.
- **`processRenewal()` is callable by anyone** — designed for keeper bots,
  no access control.
- **Pending plan changes** (amount/period) are staged and applied at next renewal,
  not immediately.
- **Batch-read pattern:** For hooks reading multiple subscriptions by ID:
  `useReadContract` for ID array -> `useQuery` + `usePublicClient().readContract()`
  for details. Cap at 50 IDs, `refetchInterval: 30_000`. Avoids importing
  `@wagmi/core` directly (transitive dep only).
- **Keeper uses viem directly** (not wagmi) — it's server-side Node.js.

---

## Roadmap & What's Next

See **[`docs/ROADMAP.md`](docs/ROADMAP.md)** for the full phased plan with checkboxes.

When asked "what next?", read `docs/ROADMAP.md`, find the first unchecked item,
and work on that. Mark items `[x]` as they are completed, then move to the next.

---

## Owner

This project is maintained by **boiler** (boilerhaus). When generating
documentation, commit messages, or PR descriptions, default to that identity.
The repository will live at `github.com/BoilerHAUS/tips-boilerhaus`.
