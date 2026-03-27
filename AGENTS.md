# AGENTS.md

This repository already has a detailed [CLAUDE.md](./CLAUDE.md). Use this file as the concise, agent-focused orientation doc and keep it aligned with `CLAUDE.md` when project guidance changes.

## Project Summary

`tips-boilerhaus` is a crypto-native, non-custodial creator funding protocol deployed at `tips.boilerhaus.org`.

Supported payment modes:

- Tip: one-time ETH or ERC-20 transfer
- Subscription: recurring ERC-20 pull payment via `SubscriptionManager`
- Stream: continuous Superfluid token flow

Primary chain targets:

- Base mainnet for production
- Base Sepolia for development

## Repository Layout

```text
apps/web            Next.js 14 frontend
packages/contracts  Solidity contracts using Foundry
packages/keeper     Renewal keeper service for subscriptions
packages/shared     Shared TypeScript types
infra/docker        Dockerfiles and compose config
docs                Architecture and development docs
```

Important deeper references:

- `README.md` for product overview
- `docs/development.md` for setup and deployment flow
- `CLAUDE.md` for expanded architecture and feature history

## Core Commands

Run from the repo root unless a package-specific command is clearer.

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

Useful targeted commands:

```bash
pnpm --filter @tips/web dev
pnpm --filter @tips/web build
pnpm --filter @tips/web lint
pnpm --filter @tips/web typecheck

pnpm --filter @tips/contracts build
pnpm --filter @tips/contracts test

pnpm --filter @tips/keeper start
pnpm --filter @tips/keeper typecheck
```

Notes:

- Root scripts are orchestrated through Turborepo.
- `pnpm test` mainly exercises package-level test scripts; contract tests are the meaningful current test suite.
- `apps/web` runs on port `3000`.

## Environment

Environment variables are documented in [`/.env.example`](./.env.example).

Key points:

- Minimum local frontend requirement: `NEXT_PUBLIC_PRIVY_APP_ID`
- Contract addresses are optional until deployment:
  - `NEXT_PUBLIC_REGISTRY_CONTRACT_ADDRESS`
  - `NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS`
- Creator metadata uploads require:
  - `PINATA_JWT`
  - `NEXT_PUBLIC_PINATA_GATEWAY_URL`
- Coinbase onramp requires:
  - `COINBASE_ONRAMP_API_KEY`
  - `COINBASE_ONRAMP_API_SECRET`

Behavioral constraints from [`apps/web/src/env.ts`](./apps/web/src/env.ts):

- `NEXT_PUBLIC_*` variables are baked into the client build
- env parsing is Zod-based
- the app intentionally tolerates missing env during static generation and falls back to safe defaults

## Repo Conventions

### TypeScript and shared models

- TypeScript is strict; avoid `any`
- Shared domain types belong in `packages/shared`
- Wallet addresses should use viem-style `0x${string}` types
- Token amounts in logic should stay as `bigint`; format only at the display layer

### Frontend patterns

- Next.js App Router only
- Prefer Server Components; add `'use client'` only for client-only behavior
- Use wagmi hooks for contract reads/writes in React
- Use TanStack Query for async data, not ad hoc `useEffect` fetch code
- Use the `@/*` alias in `apps/web` instead of deep relative imports

### Contracts and chain logic

- Solidity contracts live under `packages/contracts/src`
- Foundry is the source of truth for contract build/test/deploy flows
- Keep ABI and contract address changes centralized in `apps/web/src/lib/contracts.ts`
- Treat on-chain amounts, periods, and token identifiers carefully; avoid lossy conversions

### Validation and config

- Follow the Zod env validation pattern already used in `apps/web/src/env.ts`
- Prefer existing config modules over scattering chain IDs, addresses, or token metadata through components

## Areas To Touch Carefully

- `apps/web/src/lib/contracts.ts`, `tokens.ts`, and `superfluid.ts` are config-heavy and affect multiple flows
- `apps/web/src/app/api/*` contains server-side integrations for Pinata and Coinbase
- `packages/contracts` changes usually require corresponding frontend ABI/address updates
- `packages/contracts/lib` contains vendored dependencies; avoid editing those unless intentionally updating upstream code

## Practical Agent Workflow

When making changes:

1. Read the relevant package entrypoints and nearby config before editing.
2. Prefer minimal, local changes that match existing patterns.
3. Run the narrowest useful validation first, then broader checks if the change spans packages.
4. If behavior depends on chain state, document assumptions clearly in the final summary.

If this file and the code disagree, trust the code first, then update the docs.
