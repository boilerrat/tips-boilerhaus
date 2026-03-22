# Development Guide

## Prerequisites

- Node.js 20+
- pnpm 9+ (`npm install -g pnpm`)
- Foundry (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)
- Docker and Docker Compose (for production testing)
- A WalletConnect project ID from [cloud.walletconnect.com](https://cloud.walletconnect.com)

---

## Getting Started

Clone the repository and install dependencies from the root:

```bash
git clone https://github.com/BoilerHAUS/tips-boilerhaus.git
cd tips-boilerhaus
pnpm install
```

Copy the environment variable template and fill in your values:

```bash
cp .env.example apps/web/.env.local
```

At minimum, set `NEXT_PUBLIC_PRIVY_APP_ID` to run the frontend locally. Create a free app at [dashboard.privy.io](https://dashboard.privy.io) to get your app ID. All other vars have sensible defaults for development against Base Sepolia.

Start the development server:

```bash
pnpm dev
```

The web app will be available at `http://localhost:3000`.

---

## Working with Contracts

Contracts live in `packages/contracts/` and use the Foundry toolchain.

```bash
cd packages/contracts

# Build
forge build

# Run tests with verbose output
forge test -vvv

# Deploy to Base Sepolia (requires DEPLOYER_PRIVATE_KEY and RPC URL in env)
forge script scripts/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify
```

After deploying, update `NEXT_PUBLIC_REGISTRY_CONTRACT_ADDRESS` in your local env and in GitHub Secrets for CI deploys.

---

## Branch and PR Conventions

This project follows an issue-first workflow. Every code change begins with an open GitHub issue.

Branch naming follows conventional prefixes:

- `feat/short-description` — new feature
- `fix/short-description` — bug fix
- `chore/short-description` — maintenance, tooling, dependencies
- `docs/short-description` — documentation only

All PRs must include: scope (which lanes are touched), risk assessment, validation steps, and rollback instructions. See `.github/ISSUE_TEMPLATE/` for the full templates.

`main` is the production branch. Direct pushes are not permitted — all changes go through a PR with at least one review and passing CI.

---

## Commit Style

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add Superfluid stream payment mode
fix: resolve ENS lookup timeout on Base Sepolia
chore: bump wagmi to 2.11.0
docs: update architecture diagram for subscription flow
```

Conventional commit messages enable automated changelog generation and make `git log` readable.

---

## Environment Variables

All environment variables are documented in `.env.example` at the repository root. The `apps/web/src/env.ts` module validates them at startup using Zod — if a required variable is missing or malformed, the app will throw immediately with a clear error rather than failing silently at runtime.

`NEXT_PUBLIC_*` variables are baked into the Next.js bundle at build time. Changing them requires a rebuild and redeploy.

---

## Docker / Production Build

To test the production Docker build locally:

```bash
cd infra/docker

# Build the image (supply your env vars)
docker build \
  --build-arg NEXT_PUBLIC_PRIVY_APP_ID=your_id \
  --build-arg NEXT_PUBLIC_DEFAULT_CHAIN_ID=84532 \
  -f Dockerfile.web \
  -t tips-web:local \
  ../..

# Run it
docker run -p 3000:3000 tips-web:local
```

For full stack with Traefik routing, use the docker-compose file:

```bash
docker compose -f infra/docker/docker-compose.yml up
```

This expects the `traefik_public` external network to exist on the host, as configured by the existing Dokploy/Traefik setup on `boilerhaus.org`.

---

## Deployment

Deploys to `tips.boilerhaus.org` are triggered automatically on every merge to `main` via the GitHub Actions CI pipeline. The pipeline:

1. Validates (lint, typecheck, test)
2. Builds and pushes a Docker image tagged with the Git SHA to GitHub Container Registry
3. SSHes into the VPS and restarts the service with the new image

Manual rollback (if needed):

```bash
ssh boilerrat@boilerhaus.org
cd ~/tips-boilerhaus/infra/docker
GIT_SHA=sha-<previous_sha> docker compose up -d web
```
