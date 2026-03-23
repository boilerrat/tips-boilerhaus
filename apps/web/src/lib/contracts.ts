/**
 * Contract addresses and ABIs for the tips protocol.
 *
 * The ABI is extracted from the Foundry build output of CreatorRegistry.sol.
 * The contract address comes from env — it is set after deployment.
 */

import { env } from '@/env'

/** Deployed CreatorRegistry address (undefined until first deploy). */
export const REGISTRY_ADDRESS = env.NEXT_PUBLIC_REGISTRY_CONTRACT_ADDRESS as
  | `0x${string}`
  | undefined

/**
 * CreatorRegistry ABI — generated from `forge build`.
 * Keep this in sync with packages/contracts/src/CreatorRegistry.sol.
 */
export const creatorRegistryAbi = [
  {
    type: 'constructor',
    inputs: [{ name: '_feeRecipient', type: 'address' }],
    stateMutability: 'nonpayable',
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
  { type: 'error', name: 'ERC20TransferFailed', inputs: [] },
  { type: 'error', name: 'ETHTransferFailed', inputs: [] },
  { type: 'error', name: 'IncorrectETHAmount', inputs: [] },
  { type: 'error', name: 'NotRegistered', inputs: [] },
] as const
