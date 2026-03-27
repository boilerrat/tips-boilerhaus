# boilerhaus tips

Crypto-native creator funding protocol. One-time tips, recurring subscriptions, and real-time Superfluid token streams — all non-custodial, wallet-to-wallet, deployed on Base.

**Live at:** `tips.boilerhaus.org`

---

## Payment Modes

**Tip** — A single ETH or ERC-20 transfer routed directly to the recipient's address. No intermediary, no custody.

**Subscription** — A recurring periodic payment with a pre-approved token allowance. The creator collects on a defined schedule.

**Stream** — A continuous per-second token flow via [Superfluid](https://superfluid.finance) that runs until either party cancels it.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), Privy, wagmi v2, Tailwind CSS |
| Contracts | Solidity 0.8.24, Foundry, deployed on Base |
| Automation | Node.js keeper service for subscription renewals |
| Streaming | Superfluid Protocol (CFA) |
| Infrastructure | Docker, Traefik, OVH VPS (boilerhaus.org) |
| CI/CD | GitHub Actions → GHCR → SSH deploy |

---

## Repository Structure

```
apps/web          — Next.js frontend
packages/contracts — Solidity smart contracts (Foundry)
packages/keeper   — Subscription renewal keeper
packages/shared   — Shared TypeScript types
infra/            — Docker and Traefik configuration
docs/             — Architecture and development documentation
```

---

## Documentation

- [Architecture](docs/architecture.md) — system design, payment flows, chain rationale
- [Development Guide](docs/development.md) — getting started, workflow conventions, deployment

---

## Creator Payment URLs

Every creator gets a shareable link:

```
tips.boilerhaus.org/pay/boilerrat.eth
tips.boilerhaus.org/pay/0xabc...123
```

ENS names and raw addresses both work.

---

## License

MIT
