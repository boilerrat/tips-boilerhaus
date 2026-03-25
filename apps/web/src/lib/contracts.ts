/**
 * Contract addresses and ABIs for the tips protocol.
 *
 * ABIs are extracted from the Foundry build output.
 * Contract addresses come from env — set after deployment.
 */

import { env } from '@/env'

/** Deployed CreatorRegistry address (undefined until first deploy). */
export const REGISTRY_ADDRESS = env.NEXT_PUBLIC_REGISTRY_CONTRACT_ADDRESS as
  | `0x${string}`
  | undefined

/** Deployed SubscriptionManager address (undefined until first deploy). */
export const SUBSCRIPTION_MANAGER_ADDRESS = env.NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS as
  | `0x${string}`
  | undefined

/**
 * CreatorRegistry ABI — generated from `forge build`.
 * Keep this in sync with packages/contracts/src/CreatorRegistry.sol.
 */
export const creatorRegistryAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: '_feeRecipient', type: 'address' },
      { name: '_feeBps', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'MAX_FEE_BPS',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MAX_TIERS',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'deactivate',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'feeBps',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'feeRecipient',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getCreator',
    inputs: [{ name: 'creator', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'creatorAddress', type: 'address' },
          { name: 'metadataIpfsHash', type: 'string' },
          {
            name: 'tiers',
            type: 'tuple[]',
            components: [
              { name: 'label', type: 'string' },
              { name: 'amountWei', type: 'uint256' },
              { name: 'tokenAddress', type: 'address' },
              { name: 'mode', type: 'uint8' },
            ],
          },
          { name: 'registeredAt', type: 'uint256' },
          { name: 'active', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'reactivate',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'register',
    inputs: [
      { name: 'metadataIpfsHash', type: 'string' },
      {
        name: 'tiers',
        type: 'tuple[]',
        components: [
          { name: 'label', type: 'string' },
          { name: 'amountWei', type: 'uint256' },
          { name: 'tokenAddress', type: 'address' },
          { name: 'mode', type: 'uint8' },
        ],
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'registered',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'tip',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'message', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'updateProfile',
    inputs: [
      { name: 'metadataIpfsHash', type: 'string' },
      {
        name: 'tiers',
        type: 'tuple[]',
        components: [
          { name: 'label', type: 'string' },
          { name: 'amountWei', type: 'uint256' },
          { name: 'tokenAddress', type: 'address' },
          { name: 'mode', type: 'uint8' },
        ],
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'CreatorDeactivated',
    inputs: [
      { name: 'creator', type: 'address', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'CreatorReactivated',
    inputs: [
      { name: 'creator', type: 'address', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'CreatorRegistered',
    inputs: [
      { name: 'creator', type: 'address', indexed: true },
      { name: 'metadataIpfsHash', type: 'string', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'CreatorUpdated',
    inputs: [
      { name: 'creator', type: 'address', indexed: true },
      { name: 'metadataIpfsHash', type: 'string', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'TipReceived',
    inputs: [
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'sender', type: 'address', indexed: true },
      { name: 'token', type: 'address', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'message', type: 'string', indexed: false },
    ],
  },
  { type: 'error', name: 'AlreadyActive', inputs: [] },
  { type: 'error', name: 'AlreadyInactive', inputs: [] },
  { type: 'error', name: 'AlreadyRegistered', inputs: [] },
  { type: 'error', name: 'ETHTransferFailed', inputs: [] },
  { type: 'error', name: 'FeeTooHigh', inputs: [] },
  { type: 'error', name: 'IncorrectETHAmount', inputs: [] },
  { type: 'error', name: 'InvalidRecipient', inputs: [] },
  { type: 'error', name: 'NotRegistered', inputs: [] },
  { type: 'error', name: 'TooManyTiers', inputs: [] },
  { type: 'error', name: 'ZeroAddress', inputs: [] },
] as const

/**
 * SubscriptionManager ABI — generated from `forge build`.
 * Keep this in sync with packages/contracts/src/SubscriptionManager.sol.
 */
export const subscriptionManagerAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: '_feeRecipient', type: 'address' },
      { name: '_feeBps', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'MAX_FEE_BPS',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MIN_PERIOD',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MAX_PERIOD',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'feeBps',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'feeRecipient',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nextSubscriptionId',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'subscribe',
    inputs: [
      { name: 'creator', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'amountPerPeriod', type: 'uint256' },
      { name: 'periodSeconds', type: 'uint256' },
    ],
    outputs: [{ name: 'subscriptionId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'updateSubscription',
    inputs: [
      { name: 'subscriptionId', type: 'uint256' },
      { name: 'newAmountPerPeriod', type: 'uint256' },
      { name: 'newPeriodSeconds', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'cancel',
    inputs: [{ name: 'subscriptionId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'processRenewal',
    inputs: [{ name: 'subscriptionId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getSubscription',
    inputs: [{ name: 'subscriptionId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'subscriber', type: 'address' },
          { name: 'creator', type: 'address' },
          { name: 'token', type: 'address' },
          { name: 'amountPerPeriod', type: 'uint256' },
          { name: 'periodSeconds', type: 'uint256' },
          { name: 'startTimestamp', type: 'uint256' },
          { name: 'lastPaidTimestamp', type: 'uint256' },
          { name: 'active', type: 'bool' },
          { name: 'pendingAmount', type: 'uint256' },
          { name: 'pendingPeriod', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getSubscriptionsBySubscriber',
    inputs: [{ name: 'subscriber', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getSubscriptionsByCreator',
    inputs: [{ name: 'creator', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'SubscriptionCreated',
    inputs: [
      { name: 'subscriptionId', type: 'uint256', indexed: true },
      { name: 'subscriber', type: 'address', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'token', type: 'address', indexed: false },
      { name: 'amountPerPeriod', type: 'uint256', indexed: false },
      { name: 'periodSeconds', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'SubscriptionRenewed',
    inputs: [
      { name: 'subscriptionId', type: 'uint256', indexed: true },
      { name: 'subscriber', type: 'address', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'SubscriptionUpdated',
    inputs: [
      { name: 'subscriptionId', type: 'uint256', indexed: true },
      { name: 'subscriber', type: 'address', indexed: true },
      { name: 'newAmountPerPeriod', type: 'uint256', indexed: false },
      { name: 'newPeriodSeconds', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'SubscriptionCancelled',
    inputs: [
      { name: 'subscriptionId', type: 'uint256', indexed: true },
      { name: 'subscriber', type: 'address', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  { type: 'error', name: 'ZeroAddress', inputs: [] },
  { type: 'error', name: 'FeeTooHigh', inputs: [] },
  { type: 'error', name: 'InvalidPeriod', inputs: [] },
  { type: 'error', name: 'ZeroAmount', inputs: [] },
  { type: 'error', name: 'InvalidRecipient', inputs: [] },
  { type: 'error', name: 'NotSubscriber', inputs: [] },
  { type: 'error', name: 'SubscriptionNotActive', inputs: [] },
  { type: 'error', name: 'RenewalTooEarly', inputs: [] },
  { type: 'error', name: 'TransferFailed', inputs: [] },
] as const
