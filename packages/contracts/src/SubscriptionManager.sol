// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SubscriptionManager
 * @notice Manages recurring ERC-20 pull-payment subscriptions. Subscribers
 *         pre-approve a token allowance; any address (keeper) can trigger
 *         renewal once the period elapses. Non-custodial — tokens stay in
 *         the subscriber's wallet until pulled.
 * @dev No receive() or fallback() — this contract never holds ETH or tokens
 *      beyond the moment of transfer. Fee-on-transfer and rebasing tokens
 *      are NOT supported. Native ETH subscriptions are not supported — use
 *      WETH (wrapped ETH) instead.
 */
contract SubscriptionManager is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ----------------------------------------------------------------
    // Constants
    // ----------------------------------------------------------------

    /// @notice Maximum protocol fee: 5% (500 basis points).
    uint256 public constant MAX_FEE_BPS = 500;

    /// @notice Minimum subscription period: 1 day.
    uint256 public constant MIN_PERIOD = 86_400;

    /// @notice Maximum subscription period: 365 days.
    uint256 public constant MAX_PERIOD = 31_536_000;

    // ----------------------------------------------------------------
    // Types
    // ----------------------------------------------------------------

    struct Subscription {
        uint256 id;
        address subscriber;
        address creator;
        address token;
        uint256 amountPerPeriod;
        uint256 periodSeconds;
        uint256 startTimestamp;
        uint256 lastPaidTimestamp;
        bool active;
        // Pending plan change — applied at next renewal
        uint256 pendingAmount; // 0 = no pending change
        uint256 pendingPeriod; // 0 = no pending change
    }

    // ----------------------------------------------------------------
    // Immutable configuration
    // ----------------------------------------------------------------

    /// @notice Protocol fee in basis points (0 = no fee). Set at deploy, cannot change.
    uint256 public immutable feeBps;

    /// @notice Address receiving protocol fees. Set at deploy, cannot change.
    address public immutable feeRecipient;

    // ----------------------------------------------------------------
    // Storage
    // ----------------------------------------------------------------

    /// @notice Auto-incrementing subscription ID counter.
    uint256 public nextSubscriptionId;

    /// @notice Subscription by ID.
    mapping(uint256 => Subscription) private _subscriptions;

    /// @notice Subscription IDs per subscriber address.
    mapping(address => uint256[]) private _subscriberSubs;

    /// @notice Subscription IDs per creator address.
    mapping(address => uint256[]) private _creatorSubs;

    // ----------------------------------------------------------------
    // Events
    // ----------------------------------------------------------------

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

    // ----------------------------------------------------------------
    // Errors
    // ----------------------------------------------------------------

    error ZeroAddress();
    error FeeTooHigh();
    error InvalidPeriod();
    error ZeroAmount();
    error InvalidRecipient();
    error NotSubscriber();
    error SubscriptionNotActive();
    error RenewalTooEarly();
    error TransferFailed();

    // ----------------------------------------------------------------
    // Constructor
    // ----------------------------------------------------------------

    /// @param _feeRecipient Address that collects protocol fees (when feeBps > 0).
    /// @param _feeBps Protocol fee in basis points (0–500). Immutable after deploy.
    constructor(address _feeRecipient, uint256 _feeBps) {
        if (_feeRecipient == address(0)) revert ZeroAddress();
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh();

        feeRecipient = _feeRecipient;
        feeBps = _feeBps;
    }

    // ----------------------------------------------------------------
    // Subscribe
    // ----------------------------------------------------------------

    /// @notice Create a subscription and pull the first payment immediately.
    /// @dev Caller must have approved this contract for at least `amountPerPeriod`
    ///      on the ERC-20 token. Recommended: approve 12x for uninterrupted renewals.
    /// @param creator Address of the creator receiving payments.
    /// @param token ERC-20 token address (use WETH for ETH-denominated subscriptions).
    /// @param amountPerPeriod Payment amount per period in token atomic units.
    /// @param periodSeconds Duration of each period in seconds (86400–31536000).
    /// @return subscriptionId The ID of the newly created subscription.
    function subscribe(
        address creator,
        address token,
        uint256 amountPerPeriod,
        uint256 periodSeconds
    ) external nonReentrant returns (uint256 subscriptionId) {
        if (creator == address(0)) revert InvalidRecipient();
        if (creator == msg.sender) revert InvalidRecipient();
        if (token == address(0)) revert ZeroAddress();
        if (amountPerPeriod == 0) revert ZeroAmount();
        if (periodSeconds < MIN_PERIOD || periodSeconds > MAX_PERIOD) revert InvalidPeriod();

        subscriptionId = nextSubscriptionId;
        nextSubscriptionId++;

        Subscription storage sub = _subscriptions[subscriptionId];
        sub.id = subscriptionId;
        sub.subscriber = msg.sender;
        sub.creator = creator;
        sub.token = token;
        sub.amountPerPeriod = amountPerPeriod;
        sub.periodSeconds = periodSeconds;
        sub.startTimestamp = block.timestamp;
        sub.lastPaidTimestamp = block.timestamp;
        sub.active = true;

        _subscriberSubs[msg.sender].push(subscriptionId);
        _creatorSubs[creator].push(subscriptionId);

        emit SubscriptionCreated(
            subscriptionId, msg.sender, creator, token, amountPerPeriod, periodSeconds
        );

        // Pull first payment immediately
        _pullPayment(sub);
    }

    // ----------------------------------------------------------------
    // Update (plan change)
    // ----------------------------------------------------------------

    /// @notice Schedule a plan change for an active subscription. The new amount
    ///         and period take effect at the next renewal — the current period
    ///         continues at the old rate.
    /// @param subscriptionId The subscription to update.
    /// @param newAmountPerPeriod New payment amount per period (must be > 0).
    /// @param newPeriodSeconds New period duration in seconds (86400–31536000).
    function updateSubscription(
        uint256 subscriptionId,
        uint256 newAmountPerPeriod,
        uint256 newPeriodSeconds
    ) external {
        Subscription storage sub = _subscriptions[subscriptionId];
        if (sub.subscriber != msg.sender) revert NotSubscriber();
        if (!sub.active) revert SubscriptionNotActive();
        if (newAmountPerPeriod == 0) revert ZeroAmount();
        if (newPeriodSeconds < MIN_PERIOD || newPeriodSeconds > MAX_PERIOD) revert InvalidPeriod();

        sub.pendingAmount = newAmountPerPeriod;
        sub.pendingPeriod = newPeriodSeconds;

        emit SubscriptionUpdated(subscriptionId, msg.sender, newAmountPerPeriod, newPeriodSeconds);
    }

    // ----------------------------------------------------------------
    // Cancel
    // ----------------------------------------------------------------

    /// @notice Cancel an active subscription. Takes effect immediately.
    ///         No refund for the current (already-paid) period.
    /// @param subscriptionId The subscription to cancel.
    function cancel(uint256 subscriptionId) external {
        Subscription storage sub = _subscriptions[subscriptionId];
        if (sub.subscriber != msg.sender) revert NotSubscriber();
        if (!sub.active) revert SubscriptionNotActive();

        sub.active = false;
        // Clear any pending plan change
        sub.pendingAmount = 0;
        sub.pendingPeriod = 0;

        emit SubscriptionCancelled(subscriptionId, msg.sender, sub.creator, block.timestamp);
    }

    // ----------------------------------------------------------------
    // Renewal (keeper-callable)
    // ----------------------------------------------------------------

    /// @notice Pull the next payment for a subscription. Can be called by anyone
    ///         (designed for keeper automation). Succeeds only if the full period
    ///         has elapsed since the last payment and the subscriber has sufficient
    ///         balance and allowance.
    /// @dev If a pending plan change exists, it is applied before pulling payment.
    /// @param subscriptionId The subscription to renew.
    function processRenewal(uint256 subscriptionId) external nonReentrant {
        Subscription storage sub = _subscriptions[subscriptionId];
        if (!sub.active) revert SubscriptionNotActive();
        if (block.timestamp < sub.lastPaidTimestamp + sub.periodSeconds) revert RenewalTooEarly();

        // Apply pending plan change if any
        if (sub.pendingAmount > 0) {
            sub.amountPerPeriod = sub.pendingAmount;
            sub.periodSeconds = sub.pendingPeriod;
            sub.pendingAmount = 0;
            sub.pendingPeriod = 0;
        }

        sub.lastPaidTimestamp = block.timestamp;

        _pullPayment(sub);
    }

    // ----------------------------------------------------------------
    // Views
    // ----------------------------------------------------------------

    /// @notice Fetch a subscription by ID.
    /// @param subscriptionId The ID to look up.
    /// @return The Subscription struct (empty if not found).
    function getSubscription(uint256 subscriptionId) external view returns (Subscription memory) {
        return _subscriptions[subscriptionId];
    }

    /// @notice Get all subscription IDs for a subscriber.
    /// @param subscriber The subscriber address.
    /// @return Array of subscription IDs (includes cancelled).
    function getSubscriptionsBySubscriber(address subscriber) external view returns (uint256[] memory) {
        return _subscriberSubs[subscriber];
    }

    /// @notice Get all subscription IDs for a creator.
    /// @param creator The creator address.
    /// @return Array of subscription IDs (includes cancelled).
    function getSubscriptionsByCreator(address creator) external view returns (uint256[] memory) {
        return _creatorSubs[creator];
    }

    // ----------------------------------------------------------------
    // Internal
    // ----------------------------------------------------------------

    /// @dev Pull payment from subscriber to creator, deducting protocol fee.
    ///      Uses SafeERC20 to handle non-standard ERC-20 return values.
    /// @param sub The subscription to process payment for.
    function _pullPayment(Subscription storage sub) internal {
        uint256 amount = sub.amountPerPeriod;
        uint256 fee = 0;
        uint256 creatorAmount = amount;

        if (feeBps > 0) {
            fee = (amount * feeBps) / 10_000;
            creatorAmount = amount - fee;
        }

        // Emit before external calls (CEI pattern)
        emit SubscriptionRenewed(sub.id, sub.subscriber, sub.creator, creatorAmount, block.timestamp);

        IERC20(sub.token).safeTransferFrom(sub.subscriber, sub.creator, creatorAmount);

        if (fee > 0) {
            IERC20(sub.token).safeTransferFrom(sub.subscriber, feeRecipient, fee);
        }
    }
}
