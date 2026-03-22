// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {CreatorRegistry} from "../src/CreatorRegistry.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

/**
 * @title CreatorRegistryTest
 * @notice Foundry tests for CreatorRegistry covering registration, profile
 *         management, ETH and ERC-20 tip routing, and edge cases.
 */
contract CreatorRegistryTest is Test {
    CreatorRegistry public registry;
    MockERC20 public token;

    address deployer = makeAddr("deployer");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address charlie = makeAddr("charlie");

    string constant METADATA_HASH = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
    string constant UPDATED_HASH = "bafybeihkoviema7g3gxyt6la7vd5ho32uj3hrmk7bnth7mc3svjhguq5re";

    function setUp() public {
        vm.prank(deployer);
        registry = new CreatorRegistry(deployer);

        token = new MockERC20("Test Token", "TST", 18);
    }

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------

    function _singleTier() internal pure returns (CreatorRegistry.PaymentTier[] memory) {
        CreatorRegistry.PaymentTier[] memory tiers = new CreatorRegistry.PaymentTier[](1);
        tiers[0] = CreatorRegistry.PaymentTier({
            label: "Coffee",
            amountWei: 0.001 ether,
            tokenAddress: address(0),
            mode: CreatorRegistry.PaymentMode.TIP
        });
        return tiers;
    }

    function _twoTiers() internal view returns (CreatorRegistry.PaymentTier[] memory) {
        CreatorRegistry.PaymentTier[] memory tiers = new CreatorRegistry.PaymentTier[](2);
        tiers[0] = CreatorRegistry.PaymentTier({
            label: "Coffee",
            amountWei: 0.001 ether,
            tokenAddress: address(0),
            mode: CreatorRegistry.PaymentMode.TIP
        });
        tiers[1] = CreatorRegistry.PaymentTier({
            label: "Monthly",
            amountWei: 5 ether,
            tokenAddress: address(token),
            mode: CreatorRegistry.PaymentMode.SUBSCRIPTION
        });
        return tiers;
    }

    // ----------------------------------------------------------------
    // Registration
    // ----------------------------------------------------------------

    function test_register_success() public {
        CreatorRegistry.PaymentTier[] memory tiers = _singleTier();

        vm.expectEmit(true, false, false, true);
        emit CreatorRegistry.CreatorRegistered(alice, METADATA_HASH, block.timestamp);

        vm.prank(alice);
        registry.register(METADATA_HASH, tiers);

        assertTrue(registry.registered(alice));

        CreatorRegistry.Creator memory c = registry.getCreator(alice);
        assertEq(c.creatorAddress, alice);
        assertEq(c.metadataIpfsHash, METADATA_HASH);
        assertEq(c.tiers.length, 1);
        assertEq(c.tiers[0].label, "Coffee");
        assertEq(c.tiers[0].amountWei, 0.001 ether);
        assertEq(c.tiers[0].tokenAddress, address(0));
        assertTrue(c.active);
        assertEq(c.registeredAt, block.timestamp);
    }

    function test_register_revert_duplicate() public {
        vm.prank(alice);
        registry.register(METADATA_HASH, _singleTier());

        vm.prank(alice);
        vm.expectRevert(CreatorRegistry.AlreadyRegistered.selector);
        registry.register(METADATA_HASH, _singleTier());
    }

    function test_register_with_multiple_tiers() public {
        CreatorRegistry.PaymentTier[] memory tiers = _twoTiers();

        vm.prank(alice);
        registry.register(METADATA_HASH, tiers);

        CreatorRegistry.Creator memory c = registry.getCreator(alice);
        assertEq(c.tiers.length, 2);
        assertEq(c.tiers[1].label, "Monthly");
        assertEq(uint8(c.tiers[1].mode), uint8(CreatorRegistry.PaymentMode.SUBSCRIPTION));
    }

    function test_register_with_empty_tiers() public {
        CreatorRegistry.PaymentTier[] memory tiers = new CreatorRegistry.PaymentTier[](0);

        vm.prank(alice);
        registry.register(METADATA_HASH, tiers);

        CreatorRegistry.Creator memory c = registry.getCreator(alice);
        assertEq(c.tiers.length, 0);
        assertTrue(c.active);
    }

    // ----------------------------------------------------------------
    // Profile Update
    // ----------------------------------------------------------------

    function test_updateProfile_success() public {
        vm.prank(alice);
        registry.register(METADATA_HASH, _singleTier());

        CreatorRegistry.PaymentTier[] memory newTiers = _twoTiers();

        vm.expectEmit(true, false, false, true);
        emit CreatorRegistry.CreatorUpdated(alice, UPDATED_HASH, block.timestamp);

        vm.prank(alice);
        registry.updateProfile(UPDATED_HASH, newTiers);

        CreatorRegistry.Creator memory c = registry.getCreator(alice);
        assertEq(c.metadataIpfsHash, UPDATED_HASH);
        assertEq(c.tiers.length, 2);
    }

    function test_updateProfile_revert_not_registered() public {
        vm.prank(alice);
        vm.expectRevert(CreatorRegistry.NotRegistered.selector);
        registry.updateProfile(UPDATED_HASH, _singleTier());
    }

    // ----------------------------------------------------------------
    // Deactivation / Reactivation
    // ----------------------------------------------------------------

    function test_deactivate_success() public {
        vm.prank(alice);
        registry.register(METADATA_HASH, _singleTier());

        vm.expectEmit(true, false, false, true);
        emit CreatorRegistry.CreatorDeactivated(alice, block.timestamp);

        vm.prank(alice);
        registry.deactivate();

        CreatorRegistry.Creator memory c = registry.getCreator(alice);
        assertFalse(c.active);
        // Data preserved
        assertEq(c.metadataIpfsHash, METADATA_HASH);
        assertTrue(registry.registered(alice));
    }

    function test_deactivate_revert_not_registered() public {
        vm.prank(alice);
        vm.expectRevert(CreatorRegistry.NotRegistered.selector);
        registry.deactivate();
    }

    function test_deactivate_revert_already_inactive() public {
        vm.prank(alice);
        registry.register(METADATA_HASH, _singleTier());

        vm.prank(alice);
        registry.deactivate();

        vm.prank(alice);
        vm.expectRevert(CreatorRegistry.AlreadyInactive.selector);
        registry.deactivate();
    }

    function test_reactivate_success() public {
        vm.prank(alice);
        registry.register(METADATA_HASH, _singleTier());

        vm.prank(alice);
        registry.deactivate();

        vm.expectEmit(true, false, false, true);
        emit CreatorRegistry.CreatorReactivated(alice, block.timestamp);

        vm.prank(alice);
        registry.reactivate();

        CreatorRegistry.Creator memory c = registry.getCreator(alice);
        assertTrue(c.active);
    }

    function test_reactivate_revert_not_registered() public {
        vm.prank(alice);
        vm.expectRevert(CreatorRegistry.NotRegistered.selector);
        registry.reactivate();
    }

    function test_reactivate_revert_already_active() public {
        vm.prank(alice);
        registry.register(METADATA_HASH, _singleTier());

        vm.prank(alice);
        vm.expectRevert(CreatorRegistry.AlreadyActive.selector);
        registry.reactivate();
    }

    // ----------------------------------------------------------------
    // ETH Tipping
    // ----------------------------------------------------------------

    function test_tip_eth_success() public {
        uint256 tipAmount = 1 ether;
        vm.deal(alice, tipAmount);

        uint256 bobBalBefore = bob.balance;

        vm.expectEmit(true, true, false, true);
        emit CreatorRegistry.TipReceived(bob, alice, address(0), tipAmount, "great work!");

        vm.prank(alice);
        registry.tip{value: tipAmount}(bob, address(0), tipAmount, "great work!");

        assertEq(bob.balance, bobBalBefore + tipAmount);
    }

    function test_tip_eth_revert_incorrect_value() public {
        vm.deal(alice, 2 ether);

        vm.prank(alice);
        vm.expectRevert(CreatorRegistry.IncorrectETHAmount.selector);
        registry.tip{value: 0.5 ether}(bob, address(0), 1 ether, "");
    }

    function test_tip_eth_to_unregistered_address() public {
        // charlie is not registered — tips should still succeed
        assertFalse(registry.registered(charlie));

        uint256 tipAmount = 0.5 ether;
        vm.deal(alice, tipAmount);

        vm.prank(alice);
        registry.tip{value: tipAmount}(charlie, address(0), tipAmount, "hello stranger");

        assertEq(charlie.balance, tipAmount);
    }

    // ----------------------------------------------------------------
    // ERC-20 Tipping
    // ----------------------------------------------------------------

    function test_tip_erc20_success() public {
        uint256 tipAmount = 100e18;
        token.mint(alice, tipAmount);

        vm.prank(alice);
        token.approve(address(registry), tipAmount);

        uint256 bobBalBefore = token.balanceOf(bob);

        vm.expectEmit(true, true, false, true);
        emit CreatorRegistry.TipReceived(bob, alice, address(token), tipAmount, "token tip");

        vm.prank(alice);
        registry.tip(bob, address(token), tipAmount, "token tip");

        assertEq(token.balanceOf(bob), bobBalBefore + tipAmount);
        assertEq(token.balanceOf(alice), 0);
    }

    function test_tip_erc20_revert_no_approval() public {
        uint256 tipAmount = 100e18;
        token.mint(alice, tipAmount);

        // No approval — transferFrom will revert
        vm.prank(alice);
        vm.expectRevert();
        registry.tip(bob, address(token), tipAmount, "");
    }

    // ----------------------------------------------------------------
    // Fee Stub (zero-fee no-op)
    // ----------------------------------------------------------------

    function test_fee_is_zero_by_default() public view {
        assertEq(registry.feeBps(), 0);
        assertEq(registry.feeRecipient(), deployer);
    }

    function test_tip_eth_zero_fee_noop() public {
        // With feeBps == 0, the full amount goes to the recipient
        uint256 tipAmount = 1 ether;
        vm.deal(alice, tipAmount);

        uint256 deployerBalBefore = deployer.balance;
        uint256 bobBalBefore = bob.balance;

        vm.prank(alice);
        registry.tip{value: tipAmount}(bob, address(0), tipAmount, "");

        assertEq(bob.balance, bobBalBefore + tipAmount);
        assertEq(deployer.balance, deployerBalBefore); // fee recipient unchanged
    }

    // ----------------------------------------------------------------
    // View — getCreator
    // ----------------------------------------------------------------

    function test_getCreator_unregistered_returns_empty() public view {
        CreatorRegistry.Creator memory c = registry.getCreator(charlie);
        assertEq(c.creatorAddress, address(0));
        assertEq(bytes(c.metadataIpfsHash).length, 0);
        assertEq(c.tiers.length, 0);
        assertFalse(c.active);
    }

    // ----------------------------------------------------------------
    // Fuzz — tip amount
    // ----------------------------------------------------------------

    function testFuzz_tip_eth(uint256 amount) public {
        // Bound to reasonable range to avoid overflow and deal limits
        amount = bound(amount, 1, 100_000 ether);

        vm.deal(alice, amount);
        uint256 bobBalBefore = bob.balance;

        vm.prank(alice);
        registry.tip{value: amount}(bob, address(0), amount, "");

        assertEq(bob.balance, bobBalBefore + amount);
    }

    function testFuzz_tip_erc20(uint256 amount) public {
        amount = bound(amount, 1, type(uint128).max);

        token.mint(alice, amount);
        vm.prank(alice);
        token.approve(address(registry), amount);

        uint256 bobBalBefore = token.balanceOf(bob);

        vm.prank(alice);
        registry.tip(bob, address(token), amount, "");

        assertEq(token.balanceOf(bob), bobBalBefore + amount);
    }
}
