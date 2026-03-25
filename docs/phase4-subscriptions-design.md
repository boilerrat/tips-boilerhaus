# Phase 4: Subscriptions — Design Document

Last updated: 2025-03-25

---

## Overview

Recurring pull-payment subscriptions for the tips protocol. Subscribers
pre-approve an ERC-20 allowance; a keeper pulls the payment on schedule
(e.g., monthly). No funds are custodied — tokens stay in the subscriber's
wallet until each renewal is executed.

---

## Design Decision: Pull-Payment vs Sablier v2

### Evaluated: Sablier v2 (rejected)

Sablier v2 is deployed on Base mainnet (SablierLockup at
`0xc19a09A66887017F603E5dF420ed3Cb9a5c07C0A`, SablierFlow at
`0x0cbfe6ce6f05c47d6243bb3818837971c6ccb46b`), but neither product fits
the subscription use case:

- **Lockup Tranched** requires the full amount locked upfront. A subscriber
  paying $10/month for 12 months must deposit $120 immediately. This defeats
  the purpose of subscriptions — subscribers expect to pay period-by-period.

- **Flow** is continuous per-second streaming — functionally identical to
  Superfluid, which we already support in Phase 3. Adding Sablier Flow
  would be redundant.

### Chosen: Custom Pull-Payment

A `SubscriptionManager.sol` contract that:
- Stores subscription records on-chain
- Enforces period timing (cannot pull before period elapses)
- Calls `transferFrom()` to pull ERC-20 from subscriber to creator
- Deducts protocol fee (same `feeBps` pattern as `CreatorRegistry`)
- Emits events for frontend indexing

**Why this fits:**
- Non-custodial (funds stay in subscriber wallet until pulled)
- Integrates with existing `PaymentMode.SUBSCRIPTION` enum and `PaymentTier` struct
- Full control over subscription lifecycle (create, renew, cancel, pause)
- Simple contract (~300 lines), consistent with `CreatorRegistry` patterns
- No external protocol dependency

---

## Design Decision: Keeper Automation

### Evaluated Options

| Keeper | Cost | Pros | Cons |
|--------|------|------|------|
| **Self-hosted cron** | $0 (runs on OVH VPS) | Simple, no dependency, same contract interface | Single point of failure, manual monitoring |
| **Gelato Automate** | $99/month (Pro tier) | TypeScript Web3 Functions, mature infra, 10% gas premium | Monthly cost, centralized |
| **Chainlink Automation** | Pay-per-execution in LINK | Decentralized, no monthly fee | Must manage LINK on Base, 20-50% gas premium, more contract boilerplate |

### Chosen: Phased approach

1. **Launch:** Self-hosted Node.js cron on the existing OVH VPS
   - Runs every hour, queries due subscriptions, calls `processRenewal()`
   - Zero additional cost, Base gas is fractions of a cent
   - Contract interface is keeper-agnostic — any address can call `processRenewal()`

2. **Scale:** Migrate to Gelato Automate when subscription volume justifies $99/month
   - No contract changes required
   - TypeScript Web3 Function replaces the cron script

The contract is designed so **any** EOA or keeper can call `processRenewal()` —
the function validates timing and allowance internally.

---

## Contract: SubscriptionManager.sol

### Storage

```solidity
struct Subscription {
    uint256 id;
    address subscriber;
    address creator;
    address token;              // ERC-20 only (no native ETH for subscriptions)
    uint256 amountPerPeriod;    // in token atomic units
    uint256 periodSeconds;      // e.g., 2592000 = 30 days
    uint256 startTimestamp;
    uint256 lastPaidTimestamp;
    bool active;
    // Pending plan change — applied at next renewal
    uint256 pendingAmount;      // 0 = no pending change
    uint256 pendingPeriod;      // 0 = no pending change
}
```

### Constructor

```solidity
constructor(address _feeRecipient, uint256 _feeBps)
```

Same pattern as `CreatorRegistry` — immutable fee configuration.

### Functions

| Function | Access | Description |
|----------|--------|-------------|
| `subscribe(creator, token, amountPerPeriod, periodSeconds)` | Subscriber | Create subscription + pull first payment immediately |
| `updateSubscription(subscriptionId, newAmount, newPeriod)` | Subscriber | Change amount/period — takes effect at next renewal |
| `cancel(subscriptionId)` | Subscriber | Cancel an active subscription |
| `processRenewal(subscriptionId)` | Anyone (keeper) | Pull next payment if period has elapsed and allowance sufficient |
| `getSubscription(subscriptionId)` | View | Fetch subscription details |
| `getSubscriptionsByCreator(creator)` | View | List subscriptions for a creator |
| `getSubscriptionsBySubscriber(subscriber)` | View | List subscriptions for a subscriber |

### Events

```solidity
event SubscriptionCreated(
    uint256 indexed subscriptionId,
    address indexed subscriber,
    address indexed creator,
    address token,
    uint256 amountPerPeriod,
    uint256 periodSeconds
);

event SubscriptionRenewed(
    uint256 indexed subscriptionId,
    address indexed subscriber,
    address indexed creator,
    uint256 amount,
    uint256 timestamp
);

event SubscriptionUpdated(
    uint256 indexed subscriptionId,
    address indexed subscriber,
    uint256 newAmountPerPeriod,
    uint256 newPeriodSeconds
);

event SubscriptionCancelled(
    uint256 indexed subscriptionId,
    address indexed subscriber,
    address indexed creator,
    uint256 timestamp
);
```

### Key Design Rules

1. **ERC-20 only (with auto-wrap for ETH)** — Native ETH cannot be pulled
   via `transferFrom()`, so subscriptions use ERC-20 tokens. When a subscriber
   selects ETH, the frontend auto-wraps ETH → WETH via the canonical WETH
   contract (`0x4200000000000000000000000000000000000006` on all OP Stack
   chains). The subscriber chooses how many periods to pre-wrap (default: 12).
   The contract treats WETH as any other ERC-20 — no special handling needed.
   Supported tokens: USDC, DAI, WETH (auto-wrapped from ETH).

2. **First payment on subscribe** — When a subscriber calls `subscribe()`,
   the first payment is pulled immediately. `lastPaidTimestamp` is set to
   `block.timestamp`.

3. **Renewal window** — `processRenewal()` succeeds only if
   `block.timestamp >= lastPaidTimestamp + periodSeconds`. No early pulls.

4. **Graceful failure** — If `transferFrom()` fails (insufficient balance
   or revoked allowance), the subscription is NOT cancelled. It remains
   active but unpaid. The keeper can retry later. The frontend shows
   "payment failed" status based on `lastPaidTimestamp + periodSeconds < now`.

5. **No partial periods** — Cancellation takes effect immediately.
   No refunds for the current period (payment was already pulled).

6. **Protocol fee** — Same model as `CreatorRegistry.tip()`. Fee is
   deducted from each renewal amount before sending to creator.

7. **Allowance management** — Subscriber must `approve()` the
   `SubscriptionManager` contract for at least `amountPerPeriod` on the
   ERC-20 token. Recommended: approve a larger amount (e.g., 12x monthly)
   to avoid re-approving each period.

8. **No max subscriptions per subscriber** — Subscribers can have multiple
   active subscriptions to different creators (or the same creator with
   different tokens/amounts).

### Security

- `ReentrancyGuard` on all state-changing functions
- `SafeERC20` for all token transfers
- CEI pattern (Checks-Effects-Interactions)
- Zero-address validation on all address parameters
- Period bounds: minimum 1 day (`86400`), maximum 365 days (`31536000`)
- Amount bounds: minimum 1 wei (no zero-amount subscriptions)
- Only the subscriber can cancel their own subscription

---

## Keeper: Self-Hosted Cron

### Location

`apps/keeper/` — new package in the monorepo

### Logic

```
Every hour:
  1. Query SubscriptionManager for all active subscriptions
     (via events or view function)
  2. Filter to subscriptions where:
     block.timestamp >= lastPaidTimestamp + periodSeconds
  3. For each due subscription:
     a. Check subscriber's ERC-20 balance >= amountPerPeriod
     b. Check subscriber's allowance to SubscriptionManager >= amountPerPeriod
     c. If both pass, call processRenewal(subscriptionId)
     d. Log result (success or failure reason)
```

### Implementation

- TypeScript + viem (consistent with frontend stack)
- Uses the same RPC endpoints as the frontend
- Wallet: dedicated keeper EOA funded with a small amount of ETH for gas
- **Separate Docker service** — own container, own restart policy (`unless-stopped`),
  independent of web container lifecycle. Defined in `infra/docker/docker-compose.yml`.
- Logging: stdout (captured by Docker)
- Error handling: skip failed renewals, retry next cycle
- Health check: log last successful run timestamp, alert if stale >2 hours
- No database — contract is the source of truth

### New env vars

| Variable | Purpose |
|----------|---------|
| `KEEPER_PRIVATE_KEY` | EOA private key for signing renewal txs |
| `KEEPER_RPC_URL` | RPC endpoint (can reuse existing Base RPC) |
| `SUBSCRIPTION_MANAGER_ADDRESS` | Deployed contract address |

---

## Frontend

### New Components

| Component | Purpose |
|-----------|---------|
| `SubscriptionForm.tsx` | Subscribe flow: select plan, approve, subscribe |
| `SubscriptionDashboard.tsx` | Creator view: incoming subscriptions |
| `SubscriberDashboard.tsx` | Subscriber view: manage active subs |

### New Hooks

| Hook | Purpose |
|------|---------|
| `useSubscribe.ts` | approve + subscribe tx lifecycle |
| `useCancelSubscription.ts` | Cancel subscription tx |
| `useSubscriptions.ts` | Query active subscriptions (creator or subscriber) |
| `useWrapETH.ts` | Wrap ETH → WETH for subscription payment (reuses pattern from `useWrapSuperToken`) |

### SubscriptionForm Flow

```
1. Select subscription plan (from creator's subscription tiers)
   - Or enter custom amount + period
2. Select token (USDC, DAI, or ETH)
3. If ETH selected:
   a. Show WETH wrap step (same UX pattern as Super Token wrapping in StreamForm)
   b. Ask how many periods to pre-wrap (default: 12, slider or input)
   c. Wrap ETH → WETH via WETH.deposit{value: totalWrapAmount}()
   d. Continue with WETH as the subscription token
4. Check current ERC-20 allowance to SubscriptionManager
5. If insufficient allowance → "Approve" button
   - Recommend approving 12x monthly amount (or full pre-wrapped amount for ETH)
6. After approval → "Subscribe" button
   - Calls subscribe() on SubscriptionManager
   - First payment pulled immediately
7. Success state: show subscription ID, next renewal date, tx hash
   - For ETH/WETH subs: show remaining WETH balance and how many periods it covers
```

**State machine:** `idle → wrapping (ETH only) → approving → subscribing → confirming → success`

### PaymentModeSelector

Enable the subscription tab:
```tsx
{ mode: 'subscription', label: 'Subscribe', enabled: true }
```

### Creator Dashboard Addition

New section in `/creator/dashboard` showing:
- Active subscriber count
- Monthly recurring revenue (sum of active subscription amounts)
- List of subscribers with: address, token, amount, period, next renewal, status
- Status indicators: active (green), overdue (yellow), cancelled (gray)

### Subscriber Management

New page or section where subscribers can:
- View all their active subscriptions
- See next renewal date and amount
- Cancel a subscription
- See if a subscription is overdue (insufficient balance/allowance warning)
- For WETH subscriptions: see WETH balance, periods remaining, and "Top up" button
  to wrap more ETH → WETH

---

## New Lib Module

### `apps/web/src/lib/subscriptions.ts`

```typescript
/** SubscriptionManager ABI + chain-indexed addresses */
export const SUBSCRIPTION_MANAGER: Record<number, { address: `0x${string}` }> = {
  84532: { address: '0x...' }, // Base Sepolia (after deploy)
  8453:  { address: '0x...' }, // Base mainnet (Phase 5A)
}

/** Canonical WETH on OP Stack chains (Base, Base Sepolia, etc.) */
export const WETH_ADDRESS = '0x4200000000000000000000000000000000000006' as const

/** Default number of periods to pre-wrap when using ETH → WETH */
export const DEFAULT_WRAP_PERIODS = 12

/** Subscription period presets */
export const PERIOD_PRESETS = [
  { label: 'Weekly',    seconds: 604800 },
  { label: 'Monthly',   seconds: 2592000 },
  { label: 'Quarterly', seconds: 7776000 },
  { label: 'Yearly',    seconds: 31536000 },
] as const

/** Minimum period: 1 day */
export const MIN_PERIOD_SECONDS = 86400

/** Maximum period: 365 days */
export const MAX_PERIOD_SECONDS = 31536000
```

---

## Shared Types Update

The `SubscriptionPayment` interface in `packages/shared/src/types.ts` already
has the right shape. Add a `SubscriptionStatus` type:

```typescript
export type SubscriptionStatus = 'active' | 'overdue' | 'cancelled'

export interface SubscriptionRecord {
  id: bigint
  subscriber: `0x${string}`
  creator: `0x${string}`
  token: `0x${string}`
  amountPerPeriod: bigint
  periodSeconds: number
  startTimestamp: number
  lastPaidTimestamp: number
  active: boolean
  /** Derived: active && lastPaidTimestamp + periodSeconds < now */
  status: SubscriptionStatus
}
```

---

## Environment & Deployment

### New env vars to add

1. `.env.example` — add `NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS`
2. `apps/web/src/env.ts` — add to zod schema (optional, like registry address)
3. `.github/workflows/ci.yml` — add to build-args
4. Keeper-specific vars in a separate `.env.keeper` (not part of web build)

### Deployment sequence

1. Deploy `SubscriptionManager.sol` to Base Sepolia
2. Verify on Blockscout
3. Update env vars with deployed address
4. Build and deploy frontend update
5. Start keeper cron on VPS

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Subscriber revokes allowance mid-period | Graceful failure — subscription stays active, shown as overdue, keeper retries |
| Subscriber drains token balance | Same as above — no penalty, just missed payment |
| Keeper goes down | Renewals queue up. When keeper restarts, it processes all overdue renewals. No funds are lost. |
| Reentrancy via malicious ERC-20 | ReentrancyGuard + SafeERC20 + CEI pattern |
| Keeper EOA runs out of gas | Monitor balance, alert if low. Base gas is ~$0.001/tx. |
| Fee-on-transfer tokens | Not supported (documented). SafeERC20 mitigates but amounts may be off. |

---

## Implementation Order

1. **Contract:** `SubscriptionManager.sol` + Foundry tests
2. **Deploy:** Base Sepolia + verify
3. **Frontend:** hooks → lib config → SubscriptionForm → dashboards
4. **Keeper:** cron script in `apps/keeper/`
5. **Integration:** enable tab, wire up `/pay/[recipient]`, update creator dashboard
6. **Polish:** status indicators, error states, overdue warnings

---

## Resolved Design Decisions

1. **Cancelled subscriptions:** Always shown in creator dashboard (with
   "cancelled" status in gray). Never auto-removed.

2. **Keeper deployment:** Separate lightweight Docker service for isolation
   and stability. Own container, own restart policy, independent of the
   web container lifecycle.

3. **Plan changes (upgrade/downgrade):** Supported in v1 via
   `updateSubscription(subscriptionId, newAmount, newPeriod)`. The update
   takes effect at the next renewal — the current period continues at the
   old rate. This avoids partial-period refund complexity.

4. **Allowance UX:** Recommend 12x monthly bounded approval. Show clear
   allowance status and "periods remaining" in the subscriber dashboard.
