// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "forge-std/interfaces/IERC20.sol";

/**
 * @title CreatorRegistry
 * @notice On-chain registry mapping creator addresses to profile metadata and
 *         payment tier configuration. Does not custody funds — all tips route
 *         directly from sender to recipient.
 */
contract CreatorRegistry {
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
    // Storage
    // ----------------------------------------------------------------

    /// @notice Full creator profile by address.
    mapping(address => Creator) private _creators;

    /// @notice Cheap existence check without pulling the full struct.
    mapping(address => bool) public registered;

    /// @notice Protocol fee in basis points (0 = no fee). Constructor-set, immutable in Phase 1.
    uint256 public feeBps;

    /// @notice Address receiving protocol fees. Constructor-set, immutable in Phase 1.
    address public feeRecipient;

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
    error ERC20TransferFailed();

    // ----------------------------------------------------------------
    // Constructor
    // ----------------------------------------------------------------

    /// @param _feeRecipient Address that collects protocol fees (when feeBps > 0).
    constructor(address _feeRecipient) {
        feeRecipient = _feeRecipient;
        feeBps = 0;
    }

    // ----------------------------------------------------------------
    // Registration
    // ----------------------------------------------------------------

    /// @notice Register msg.sender as a creator with metadata and payment tiers.
    /// @param metadataIpfsHash CIDv1 hash pointing to IPFS metadata JSON.
    /// @param tiers Array of payment tiers the creator accepts.
    function register(string calldata metadataIpfsHash, PaymentTier[] calldata tiers) external {
        if (registered[msg.sender]) revert AlreadyRegistered();

        Creator storage c = _creators[msg.sender];
        c.creatorAddress = msg.sender;
        c.metadataIpfsHash = metadataIpfsHash;
        c.registeredAt = block.timestamp;
        c.active = true;

        for (uint256 i = 0; i < tiers.length; i++) {
            c.tiers.push(tiers[i]);
        }

        registered[msg.sender] = true;

        emit CreatorRegistered(msg.sender, metadataIpfsHash, block.timestamp);
    }

    /// @notice Update profile metadata and tiers for an existing registration.
    /// @param metadataIpfsHash New CIDv1 hash pointing to IPFS metadata JSON.
    /// @param tiers Replacement array of payment tiers.
    function updateProfile(string calldata metadataIpfsHash, PaymentTier[] calldata tiers) external {
        if (!registered[msg.sender]) revert NotRegistered();

        Creator storage c = _creators[msg.sender];
        c.metadataIpfsHash = metadataIpfsHash;

        // Replace tiers: clear then repopulate
        delete c.tiers;
        for (uint256 i = 0; i < tiers.length; i++) {
            c.tiers.push(tiers[i]);
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
    /// @param recipient Address receiving the tip.
    /// @param token ERC-20 token address, or address(0) for native ETH.
    /// @param amount Tip amount in wei (or token atomic units).
    /// @param message Optional message stored only in the event log.
    function tip(address recipient, address token, uint256 amount, string calldata message) external payable {
        uint256 fee = 0;
        uint256 recipientAmount = amount;

        // Calculate protocol fee if nonzero
        if (feeBps > 0) {
            fee = (amount * feeBps) / 10_000;
            recipientAmount = amount - fee;
        }

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
            // ERC-20 tip — requires sender to have approved this contract
            bool transferred = IERC20(token).transferFrom(msg.sender, recipient, recipientAmount);
            if (!transferred) revert ERC20TransferFailed();

            if (fee > 0) {
                bool feeTransferred = IERC20(token).transferFrom(msg.sender, feeRecipient, fee);
                if (!feeTransferred) revert ERC20TransferFailed();
            }
        }

        emit TipReceived(recipient, msg.sender, token, amount, message);
    }
}
