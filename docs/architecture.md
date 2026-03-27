# Architecture

## Overview

Boilerhaus Tips is a crypto-native creator funding protocol deployed at `tips.boilerhaus.org`. It enables three payment modes — one-time tips, recurring subscriptions, and real-time token streams — with no custody of funds at any point. All value flows directly between sender and recipient wallets.

The system is composed of a Next.js frontend, a set of smart contracts deployed on Base, and a lightweight shared types package that maintains a single source of truth for domain models across both layers.

---

## Monorepo Structure

```
tips-boilerhaus/
├── apps/
│   └── web/                  # Next.js frontend — tips.boilerhaus.org
├── packages/
│   ├── contracts/            # Solidity contracts (Foundry)
│   └── shared/               # Shared TypeScript types
├── infra/
│   ├── docker/               # Dockerfile and docker-compose
│   └── traefik/              # Traefik dynamic config for subdomain routing
├── docs/                     # Architecture and development documentation
└── .github/
    └── workflows/            # CI/CD pipeline (GitHub Actions)
```

Each directory under `apps/` and `packages/` is an independent workspace with its own `package.json`. Turborepo orchestrates builds across the monorepo, caching outputs and parallelising tasks where dependency order permits.

---

## Payment Modes

### One-Time Tip

The simplest mode. A sender connects their wallet, enters an amount, and initiates a transfer of native ETH or an ERC-20 token directly to the recipient's address. No contract interaction is required for basic ETH tips — the contract layer is optional for routing, fee collection, and event emission.

### Recurring Subscription

A periodic payment model where the sender pre-approves a token allowance and a scheduled collection occurs at a defined interval (e.g. monthly). Implementation options under evaluation: a simple approve-and-pull pattern managed by the registry contract, or Sablier v2 Lockup Linear for fixed-term commitments with on-chain enforcement.

### Real-Time Stream

Continuous per-second token flow implemented via Superfluid's Constant Flow Agreement (CFA). The sender opens a flow against the recipient in a Super Token (e.g. USDCx, ETHx). The stream runs until cancelled by either party. The frontend handles Super Token wrapping and buffer deposit UX, which are the primary friction points for new Superfluid users.

---

## Smart Contracts

The `CreatorRegistry` contract (to be deployed on Base) is the on-chain anchor of the protocol. Its responsibilities are deliberately minimal:

- Mapping creator addresses to IPFS metadata hashes (display name, bio, avatar, tier config)
- Emitting events consumed by the frontend for profile and payment history display
- Optional fee routing if a protocol fee is introduced

The registry does not custody funds. Tips route directly; streams open against the recipient directly via Superfluid's forwarder contracts.

Contracts are written in Solidity 0.8.24 and developed with Foundry. Deployment targets Base mainnet (chain ID 8453) for production and Base Sepolia (chain ID 84532) for development and testing.

---

## Frontend

The web app is a Next.js 14 application using the App Router. Key libraries:

- **Privy** — wallet authentication, embedded wallets, and account linking
- **wagmi v2 + viem** — type-safe Ethereum interactions and contract reads/writes
- **TanStack Query** — async state management for on-chain data fetching
- **Tailwind CSS** — utility-first styling
- **IBM Plex Mono / Inter** — typography (monospace for addresses and code, sans-serif for UI copy)
- **Zod** — runtime environment variable validation at startup

The creator payment page is served at `/pay/[recipient]`, where `[recipient]` is either an ENS name or a raw EVM address. ENS resolution happens at runtime via viem's built-in ENS support.

---

## Infrastructure

The app runs as a standalone Next.js Docker container behind Traefik on the existing `boilerhaus.org` OVH VPS. Traefik handles TLS termination via Let's Encrypt and routes `tips.boilerhaus.org` to the container. The deployment model is identical to other services on the host managed by Dokploy.

Images are tagged with the Git SHA of the triggering commit, which makes rollbacks a matter of restarting the previous image tag.

---

## Chain Selection

Base is the primary deployment target for the following reasons: transaction fees are low enough that small tips remain economically viable, Superfluid has full support on Base, Coinbase Wallet users encounter a native experience, and the developer ecosystem is mature. Base Sepolia serves as the testnet environment throughout development.

---

## Data Flow

```
User connects wallet (Privy)
        │
        ▼
/pay/[recipient] page resolves ENS → address
        │
        ▼
User selects payment mode (tip / subscription / stream)
        │
        ├── Tip:          direct ETH/ERC-20 transfer → recipient
        ├── Subscription: approve allowance → registry contract schedules pull
        └── Stream:       wrap token → Superfluid CFA open flow → recipient
```

No backend server is involved in the payment path. All state lives on-chain.

---

## Creator Metadata JSON Schema

The `metadataIpfsHash` field in the `CreatorRegistry` contract points to a CIDv1 IPFS hash
resolving to a JSON document conforming to this schema:

```json
{
  "displayName": "boilerrat",
  "bio": "Building onchain.",
  "avatarUrl": "ipfs://bafybeig.../avatar.png",
  "websiteUrl": "https://boilerhaus.org",
  "farcasterHandle": "boilerrat"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `displayName` | string | yes | Human-readable creator name |
| `bio` | string | no | Short bio / tagline |
| `avatarUrl` | string | no | IPFS or HTTPS URL to avatar image |
| `websiteUrl` | string | no | Creator's website |
| `farcasterHandle` | string | no | Farcaster username (without @) |

All fields except `displayName` are optional. The contract stores only the IPFS hash —
it has no opinion about the content. Frontends should validate and gracefully handle
missing fields.
