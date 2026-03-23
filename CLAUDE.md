# CLAUDE.md — Boilerhaus Tips

You are working on **tips-boilerhaus**, a crypto-native creator funding protocol
to be deployed at `tips.boilerhaus.org`. This file is your primary orientation document.
Read it fully before touching any code.

---

## What This Project Is

A non-custodial creator tipping protocol built on Base. It supports three payment modes:

- **Tip** — one-time ETH or ERC-20 transfer directly to a recipient address
- **Subscription** — recurring periodic pull against a pre-approved token allowance
- **Stream** — continuous per-second token flow via Superfluid CFA

No funds are ever custodied by the protocol. All value flows wallet-to-wallet.
Creator pages are served at `/pay/[recipient]` where recipient is an ENS name or raw address.

---

## Monorepo Structure

```
apps/web/               Next.js 14 frontend (tips.boilerhaus.org)
packages/contracts/     Solidity contracts — Foundry toolchain
packages/shared/        Shared TypeScript domain types (no framework deps)
infra/docker/           Dockerfile.web + docker-compose.yml
infra/traefik/          Traefik dynamic config for subdomain routing
docs/                   Architecture and development documentation
.github/workflows/      CI/CD pipeline (GitHub Actions)
```

Read `docs/architecture.md` and `docs/development.md` before starting any task.
They contain chain rationale, payment flow diagrams, and deployment conventions.

---

## Tech Stack

| Concern | Choice |
|---|---|
| Frontend framework | Next.js 14, App Router, TypeScript |
| Wallet / chain | wagmi v2, viem, RainbowKit v2 |
| Streaming | Superfluid Protocol (CFA) |
| Contracts | Solidity 0.8.24, Foundry |
| Styling | Tailwind CSS, IBM Plex Mono + Inter |
| Package manager | pnpm 9 (workspaces) |
| Build orchestration | Turborepo |
| Deployment | Docker standalone, Traefik, OVH VPS |
| CI/CD | GitHub Actions → GHCR → SSH deploy |
| Primary chain | Base mainnet (8453), Base Sepolia (84532) for dev |

---

## Coding Standards

### General

- TypeScript everywhere. No `any`. No implicit `any`. Strict mode is on.
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

### React / Next.js

- App Router only. No Pages Router patterns.
- Server Components by default. Add `'use client'` only when genuinely needed
  (wallet hooks, interactive state, RainbowKit components).
- wagmi hooks (`useReadContract`, `useWriteContract`, `useWatchContractEvent`) are
  the correct way to interact with contracts from the frontend — not direct viem calls
  in components.
- TanStack Query manages all async state. Do not use `useEffect` + `useState` for
  data fetching.

### Contracts

- Solidity 0.8.24. NatSpec on all public/external functions.
- No upgradeable proxy patterns unless explicitly requested — keep contracts simple.
- Every state-changing function emits an event. The frontend indexes events; silent
  state changes break the UI.
- Write Foundry tests alongside every new contract. Unit tests in `packages/contracts/test/`,
  deployment scripts in `packages/contracts/scripts/`.
- Never hardcode addresses — pass them as constructor args or read from a config.

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

---

## Infrastructure Context

The app runs on an OVH VPS at `boilerhaus.org` managed by Dokploy with Traefik
as the reverse proxy. Dokploy builds images directly from the GitHub repo —
it clones the repo and runs `docker build` using `infra/docker/Dockerfile.web`.
SSL is handled by Traefik via Let's Encrypt — do not manage certs manually.

The CI pipeline in `.github/workflows/ci.yml` also builds and pushes to GHCR,
but the production deploy is triggered from Dokploy, not CI. The CI deploy job
requires an `environment: production` with SSH secrets (`VPS_HOST`, `VPS_USER`,
`VPS_SSH_KEY`) — these are not currently configured since Dokploy handles deployment.

### Deployment Pitfalls — Lessons Learned

The following issues caused persistent **Bad Gateway** errors after initial deployment.
All three must be correct for the container to pass health checks and serve traffic.

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
standalone server binds to `0.0.0.0` (IPv4 only). This causes the health check
to get "Connection refused", Docker marks the container unhealthy, Swarm kills
and restarts it in an infinite crash loop, and Traefik returns Bad Gateway.

```dockerfile
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/ || exit 1
```

#### 3. Guard client-only providers during static page generation

Components that use wagmi/Privy hooks (e.g. `Header`) cannot render during
Next.js static page generation when `NEXT_PUBLIC_PRIVY_APP_ID` is empty.
The `Providers` wrapper in `layout.tsx` already skips mounting providers when
the app ID is missing, but any component using those hooks must also be
conditionally rendered:

```tsx
{env.NEXT_PUBLIC_PRIVY_APP_ID && <Header />}
```

Without this guard, the build fails with `WagmiProviderNotFoundError` during
static export of `/page` and `/_not-found/page`.

---

## Current State of the Codebase

The scaffold is complete. What exists:

- Full monorepo configuration (Turborepo, pnpm workspaces, tsconfig, Prettier)
- `apps/web` — Next.js app with wagmi/RainbowKit providers, env validation, Tailwind
  typography config, root layout, landing page, and `/pay/[recipient]` route stub
- `packages/shared` — Domain type definitions for all three payment modes
- `packages/contracts` — Package structure and `foundry.toml` only; no contracts yet
- `infra/` — Dockerfile, docker-compose, Traefik dynamic config
- `.github/workflows/ci.yml` — Full CI/CD pipeline
- `docs/` — Architecture and development documentation

### What Does Not Exist Yet (Immediate Next Steps)

The natural implementation order is:

1. **`CreatorRegistry` contract** (`packages/contracts/src/CreatorRegistry.sol`)
   Minimal registry mapping addresses to IPFS metadata hashes. Emit events on
   registration and profile updates. Include Foundry tests.

2. **Contract deployment script** (`packages/contracts/scripts/Deploy.s.sol`)
   Foundry script for Base Sepolia deploy. Log deployed address to stdout.

3. **Tip payment component** (`apps/web/src/components/payment/TipForm.tsx`)
   The Phase 1 UI: amount input, token selector (ETH default), send button,
   transaction status. Wire into `/pay/[recipient]/page.tsx`.

4. **ENS resolution hook** (`apps/web/src/hooks/useResolveRecipient.ts`)
   Resolves ENS → address and address → ENS display name using viem.
   Handle both directions cleanly; the `/pay/[recipient]` route receives either.

5. **Creator profile fetch** (`apps/web/src/hooks/useCreatorProfile.ts`)
   Read from the registry contract once deployed. Gracefully handle
   unregistered addresses (show raw address, allow tips anyway).

Work through these in order unless instructed otherwise.

---

## Owner

This project is maintained by **boiler** (boilerhaus). When generating
documentation, commit messages, or PR descriptions, default to that identity.
The repository will live at `github.com/BoilerHAUS/tips-boilerhaus`.
