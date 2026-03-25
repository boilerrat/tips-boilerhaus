// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CreatorRegistry
 * @notice On-chain registry mapping creator addresses to profile metadata and
 *         payment tier configuration. Does not custody funds — all tips route
 *         directly from sender to recipient.
 * @dev No receive() or fallback() — this contract never holds ETH or tokens.
 *      Fee-on-transfer and rebasing ERC-20 tokens are NOT supported.
 */
contract CreatorRegistry is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ----------------------------------------------------------------
    // Constants
    // ----------------------------------------------------------------

    /// @notice Maximum protocol fee: 5% (500 basis points).
    uint256 public constant MAX_FEE_BPS = 500;

    /// @notice Maximum number of payment tiers per creator.
    uint256 public constant MAX_TIERS = 20;

    // ----------------------------------------------------------------
    // Types
    // ----------------------------------------------------------------

    enum PaymentMode {
        TIP,
        SUBSCRIPTION,
        STREAM
    }

    struct PaymentTier {
        string label; // e.g. "Coffee", "Supporter", "Patron"
        uint256 amountWei;
        address tokenAddress; // address(0) = native ETH
        PaymentMode mode;
    }

    struct Creator {
        address creatorAddress;
        string metadataIpfsHash; // CIDv1 pointing to off-chain JSON
        PaymentTier[] tiers;
        uint256 registeredAt;
        bool active;
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

    /// @notice Full creator profile by address.
    mapping(address => Creator) private _creators;

    /// @notice Cheap existence check without pulling the full struct.
    mapping(address => bool) public registered;

    // ----------------------------------------------------------------
    // Events
    // ----------------------------------------------------------------

    event CreatorRegistered(address indexed creator, string metadataIpfsHash, uint256 timestamp);
    event CreatorUpdated(address indexed creator, string metadataIpfsHash, uint256 timestamp);
    event CreatorDeactivated(address indexed creator, uint256 timestamp);
    event CreatorReactivated(address indexed creator, uint256 timestamp);
    event TipReceived(
        address indexed recipient, address indexed sender, address token, uint256 amount, string message
    );

    // ----------------------------------------------------------------
    // Errors
    // ----------------------------------------------------------------

    error AlreadyRegistered();
    error NotRegistered();
    error AlreadyActive();
    error AlreadyInactive();
    error IncorrectETHAmount();
    error ETHTransferFailed();
    error InvalidRecipient();
    error ZeroAddress();
    error FeeTooHigh();
    error TooManyTiers();

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
    // Registration
    // ----------------------------------------------------------------

    /// @notice Register msg.sender as a creator with metadata and payment tiers.
    /// @param metadataIpfsHash CIDv1 hash pointing to IPFS metadata JSON.
    /// @param tiers Array of payment tiers the creator accepts (max 20).
    function register(string calldata metadataIpfsHash, PaymentTier[] calldata tiers) external {
        if (registered[msg.sender]) revert AlreadyRegistered();
        if (tiers.length > MAX_TIERS) revert TooManyTiers();

        registered[msg.sender] = true;

        Creator storage c = _creators[msg.sender];
        c.creatorAddress = msg.sender;
        c.metadataIpfsHash = metadataIpfsHash;
        c.registeredAt = block.timestamp;
        c.active = true;

        uint256 len = tiers.length;
        for (uint256 i = 0; i < len;) {
            c.tiers.push(tiers[i]);
            unchecked { ++i; }
        }

        emit CreatorRegistered(msg.sender, metadataIpfsHash, block.timestamp);
    }

    /// @notice Update profile metadata and tiers for an existing active registration.
    /// @param metadataIpfsHash New CIDv1 hash pointing to IPFS metadata JSON.
    /// @param tiers Replacement array of payment tiers (max 20).
    function updateProfile(string calldata metadataIpfsHash, PaymentTier[] calldata tiers) external {
        if (!registered[msg.sender]) revert NotRegistered();
        if (tiers.length > MAX_TIERS) revert TooManyTiers();

        Creator storage c = _creators[msg.sender];
        if (!c.active) revert AlreadyInactive();

        c.metadataIpfsHash = metadataIpfsHash;

        // Replace tiers: clear then repopulate
        delete c.tiers;
        uint256 len = tiers.length;
        for (uint256 i = 0; i < len;) {
            c.tiers.push(tiers[i]);
            unchecked { ++i; }
        }

        emit CreatorUpdated(msg.sender, metadataIpfsHash, block.timestamp);
    }

    /// @notice Soft-deactivate the caller's profile. Data is preserved.
    function deactivate() external {
        if (!registered[msg.sender]) revert NotRegistered();
        Creator storage c = _creators[msg.sender];
        if (!c.active) revert AlreadyInactive();

        c.active = false;
        emit CreatorDeactivated(msg.sender, block.timestamp);
    }

    /// @notice Reactivate a previously deactivated profile.
    function reactivate() external {
        if (!registered[msg.sender]) revert NotRegistered();
        Creator storage c = _creators[msg.sender];
        if (c.active) revert AlreadyActive();

        c.active = true;
        emit CreatorReactivated(msg.sender, block.timestamp);
    }

    // ----------------------------------------------------------------
    // View
    // ----------------------------------------------------------------

    /// @notice Fetch the full profile for a creator address.
    /// @param creator The address to look up.
    /// @return The Creator struct (empty if not registered).
    function getCreator(address creator) external view returns (Creator memory) {
        return _creators[creator];
    }

    // ----------------------------------------------------------------
    // Tipping
    // ----------------------------------------------------------------

    /// @notice Route a tip from msg.sender to recipient. Does not require
    ///         recipient to be registered — anyone can receive a tip.
    /// @dev For ETH tips (token == address(0)), msg.value must equal amount exactly.
    ///      For ERC-20 tips, caller must approve this contract for at least `amount`.
    ///      When feeBps > 0, recipient receives amount minus the protocol fee.
    ///      Fee-on-transfer and rebasing tokens are not supported.
    /// @param recipient Address receiving the tip.
    /// @param token ERC-20 token address, or address(0) for native ETH.
    /// @param amount Tip amount in wei (or token atomic units).
    /// @param message Optional message stored only in the event log.
    function tip(address recipient, address token, uint256 amount, string calldata message)
        external
        payable
        nonReentrant
    {
        if (recipient == address(0)) revert InvalidRecipient();

        uint256 fee = 0;
        uint256 recipientAmount = amount;

        // Calculate protocol fee if nonzero
        if (feeBps > 0) {
            fee = (amount * feeBps) / 10_000;
            recipientAmount = amount - fee;
        }

        // Emit before external calls (Checks-Effects-Interactions)
        emit TipReceived(recipient, msg.sender, token, recipientAmount, message);

        if (token == address(0)) {
            // Native ETH tip
            if (msg.value != amount) revert IncorrectETHAmount();

            (bool sentToRecipient,) = recipient.call{value: recipientAmount}("");
            if (!sentToRecipient) revert ETHTransferFailed();

            if (fee > 0) {
                (bool sentFee,) = feeRecipient.call{value: fee}("");
                if (!sentFee) revert ETHTransferFailed();
            }
        } else {
            // ERC-20 tip — reject accidental ETH
            if (msg.value != 0) revert IncorrectETHAmount();

            IERC20(token).safeTransferFrom(msg.sender, recipient, recipientAmount);

            if (fee > 0) {
                IERC20(token).safeTransferFrom(msg.sender, feeRecipient, fee);
            }
        }
    }
}
