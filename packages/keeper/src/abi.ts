/**
 * SubscriptionManager ABI — only the functions the keeper needs.
 *
 * Keep in sync with packages/contracts/src/SubscriptionManager.sol.
 */

export const subscriptionManagerAbi = [
  {
    type: 'function',
    name: 'nextSubscriptionId',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
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
    name: 'processRenewal',
    inputs: [{ name: 'subscriptionId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const
