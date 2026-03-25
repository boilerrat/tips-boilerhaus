// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {CreatorRegistry} from "../src/CreatorRegistry.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

/**
 * @title CreatorRegistryTest
 * @notice Foundry tests for CreatorRegistry covering registration, profile
 *         management, ETH and ERC-20 tip routing, fee mechanics, reentrancy
 *         guards, and edge cases.
 */
contract CreatorRegistryTest is Test {
    CreatorRegistry public registry;
    CreatorRegistry public registryWithFees;
    MockERC20 public token;

    address deployer = makeAddr("deployer");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address charlie = makeAddr("charlie");

    string constant METADATA_HASH = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
    string constant UPDATED_HASH = "bafybeihkoviema7g3gxyt6la7vd5ho32uj3hrmk7bnth7mc3svjhguq5re";

    function setUp() public {
        vm.prank(deployer);
        registry = new CreatorRegistry(deployer, 0);

        // Registry with 2.5% fee for fee-path testing
        vm.prank(deployer);
        registryWithFees = new CreatorRegistry(deployer, 250);

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

    function _emptyTiers() internal pure returns (CreatorRegistry.PaymentTier[] memory) {
        return new CreatorRegistry.PaymentTier[](0);
    }

    // ----------------------------------------------------------------
    // Constructor
    // ----------------------------------------------------------------

    function test_constructor_sets_immutables() public view {
        assertEq(registry.feeBps(), 0);
        assertEq(registry.feeRecipient(), deployer);
        assertEq(registryWithFees.feeBps(), 250);
    }

    function test_constructor_revert_zero_address() public {
        vm.expectRevert(CreatorRegistry.ZeroAddress.selector);
        new CreatorRegistry(address(0), 0);
    }

    function test_constructor_revert_fee_too_high() public {
        vm.expectRevert(CreatorRegistry.FeeTooHigh.selector);
        new CreatorRegistry(deployer, 501);
    }

    function test_constructor_max_fee_ok() public {
        CreatorRegistry r = new CreatorRegistry(deployer, 500);
        assertEq(r.feeBps(), 500);
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
        vm.prank(alice);
        registry.register(METADATA_HASH, _emptyTiers());

        CreatorRegistry.Creator memory c = registry.getCreator(alice);
        assertEq(c.tiers.length, 0);
        assertTrue(c.active);
    }

    function test_register_revert_too_many_tiers() public {
        CreatorRegistry.PaymentTier[] memory tiers = new CreatorRegistry.PaymentTier[](21);
        for (uint256 i = 0; i < 21; ++i) {
            tiers[i] = CreatorRegistry.PaymentTier({
                label: "Tier",
                amountWei: 0.001 ether,
                tokenAddress: address(0),
                mode: CreatorRegistry.PaymentMode.TIP
            });
        }

        vm.prank(alice);
        vm.expectRevert(CreatorRegistry.TooManyTiers.selector);
        registry.register(METADATA_HASH, tiers);
    }

    function test_register_max_tiers_ok() public {
        CreatorRegistry.PaymentTier[] memory tiers = new CreatorRegistry.PaymentTier[](20);
        for (uint256 i = 0; i < 20; ++i) {
            tiers[i] = CreatorRegistry.PaymentTier({
                label: "Tier",
                amountWei: 0.001 ether,
                tokenAddress: address(0),
                mode: CreatorRegistry.PaymentMode.TIP
            });
        }

        vm.prank(alice);
        registry.register(METADATA_HASH, tiers);

        CreatorRegistry.Creator memory c = registry.getCreator(alice);
        assertEq(c.tiers.length, 20);
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

    function test_updateProfile_revert_inactive() public {
        vm.prank(alice);
        registry.register(METADATA_HASH, _singleTier());

        vm.prank(alice);
        registry.deactivate();

        vm.prank(alice);
        vm.expectRevert(CreatorRegistry.AlreadyInactive.selector);
        registry.updateProfile(UPDATED_HASH, _singleTier());
    }

    function test_updateProfile_revert_too_many_tiers() public {
        vm.prank(alice);
        registry.register(METADATA_HASH, _singleTier());

        CreatorRegistry.PaymentTier[] memory tiers = new CreatorRegistry.PaymentTier[](21);
        for (uint256 i = 0; i < 21; ++i) {
            tiers[i] = CreatorRegistry.PaymentTier({
                label: "T",
                amountWei: 1,
                tokenAddress: address(0),
                mode: CreatorRegistry.PaymentMode.TIP
            });
        }

        vm.prank(alice);
        vm.expectRevert(CreatorRegistry.TooManyTiers.selector);
        registry.updateProfile(UPDATED_HASH, tiers);
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

    function test_full_lifecycle_register_deactivate_reactivate() public {
        vm.prank(alice);
        registry.register(METADATA_HASH, _singleTier());

        vm.prank(alice);
        registry.deactivate();
        assertFalse(registry.getCreator(alice).active);

        vm.prank(alice);
        registry.reactivate();
        assertTrue(registry.getCreator(alice).active);

        // Can update after reactivation
        vm.prank(alice);
        registry.updateProfile(UPDATED_HASH, _emptyTiers());
        assertEq(registry.getCreator(alice).metadataIpfsHash, UPDATED_HASH);
    }

    // ----------------------------------------------------------------
    // ETH Tipping (zero fee)
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
        assertFalse(registry.registered(charlie));

        uint256 tipAmount = 0.5 ether;
        vm.deal(alice, tipAmount);

        vm.prank(alice);
        registry.tip{value: tipAmount}(charlie, address(0), tipAmount, "hello stranger");

        assertEq(charlie.balance, tipAmount);
    }

    function test_tip_eth_revert_zero_recipient() public {
        vm.deal(alice, 1 ether);

        vm.prank(alice);
        vm.expectRevert(CreatorRegistry.InvalidRecipient.selector);
        registry.tip{value: 1 ether}(address(0), address(0), 1 ether, "");
    }

    // ----------------------------------------------------------------
    // ERC-20 Tipping (zero fee)
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

        vm.prank(alice);
        vm.expectRevert();
        registry.tip(bob, address(token), tipAmount, "");
    }

    function test_tip_erc20_revert_with_eth_value() public {
        uint256 tipAmount = 100e18;
        token.mint(alice, tipAmount);
        vm.deal(alice, 1 ether);

        vm.prank(alice);
        token.approve(address(registry), tipAmount);

        vm.prank(alice);
        vm.expectRevert(CreatorRegistry.IncorrectETHAmount.selector);
        registry.tip{value: 1 ether}(bob, address(token), tipAmount, "");
    }

    function test_tip_erc20_revert_zero_recipient() public {
        uint256 tipAmount = 100e18;
        token.mint(alice, tipAmount);

        vm.prank(alice);
        token.approve(address(registry), tipAmount);

        vm.prank(alice);
        vm.expectRevert(CreatorRegistry.InvalidRecipient.selector);
        registry.tip(address(0), address(token), tipAmount, "");
    }

    // ----------------------------------------------------------------
    // ETH Tipping with fees
    // ----------------------------------------------------------------

    function test_tip_eth_with_fee() public {
        uint256 tipAmount = 1 ether;
        vm.deal(alice, tipAmount);

        // 250 bps = 2.5%: fee = 0.025 ETH, recipient = 0.975 ETH
        uint256 expectedFee = (tipAmount * 250) / 10_000;
        uint256 expectedRecipient = tipAmount - expectedFee;

        uint256 bobBalBefore = bob.balance;
        uint256 deployerBalBefore = deployer.balance;

        vm.prank(alice);
        registryWithFees.tip{value: tipAmount}(bob, address(0), tipAmount, "with fee");

        assertEq(bob.balance, bobBalBefore + expectedRecipient);
        assertEq(deployer.balance, deployerBalBefore + expectedFee);
    }

    function test_tip_eth_with_fee_event_emits_net() public {
        uint256 tipAmount = 1 ether;
        vm.deal(alice, tipAmount);

        uint256 expectedFee = (tipAmount * 250) / 10_000;
        uint256 expectedRecipient = tipAmount - expectedFee;

        // Event should emit recipientAmount, not gross amount
        vm.expectEmit(true, true, false, true);
        emit CreatorRegistry.TipReceived(bob, alice, address(0), expectedRecipient, "");

        vm.prank(alice);
        registryWithFees.tip{value: tipAmount}(bob, address(0), tipAmount, "");
    }

    function test_tip_eth_fee_rounding_small_amount() public {
        // 1 wei with 250 bps: fee = (1 * 250) / 10000 = 0 (rounds down)
        uint256 tipAmount = 1;
        vm.deal(alice, tipAmount);

        uint256 bobBalBefore = bob.balance;
        uint256 deployerBalBefore = deployer.balance;

        vm.prank(alice);
        registryWithFees.tip{value: tipAmount}(bob, address(0), tipAmount, "");

        // Full amount goes to recipient when fee rounds to zero
        assertEq(bob.balance, bobBalBefore + tipAmount);
        assertEq(deployer.balance, deployerBalBefore); // no fee sent
    }

    function test_tip_eth_zero_fee_noop() public {
        uint256 tipAmount = 1 ether;
        vm.deal(alice, tipAmount);

        uint256 deployerBalBefore = deployer.balance;
        uint256 bobBalBefore = bob.balance;

        vm.prank(alice);
        registry.tip{value: tipAmount}(bob, address(0), tipAmount, "");

        assertEq(bob.balance, bobBalBefore + tipAmount);
        assertEq(deployer.balance, deployerBalBefore);
    }

    // ----------------------------------------------------------------
    // ERC-20 Tipping with fees
    // ----------------------------------------------------------------

    function test_tip_erc20_with_fee() public {
        uint256 tipAmount = 1000e18;
        token.mint(alice, tipAmount);

        vm.prank(alice);
        token.approve(address(registryWithFees), tipAmount);

        uint256 expectedFee = (tipAmount * 250) / 10_000;
        uint256 expectedRecipient = tipAmount - expectedFee;

        uint256 bobBalBefore = token.balanceOf(bob);
        uint256 deployerBalBefore = token.balanceOf(deployer);

        vm.prank(alice);
        registryWithFees.tip(bob, address(token), tipAmount, "erc20 fee");

        assertEq(token.balanceOf(bob), bobBalBefore + expectedRecipient);
        assertEq(token.balanceOf(deployer), deployerBalBefore + expectedFee);
        assertEq(token.balanceOf(alice), 0);
    }

    // ----------------------------------------------------------------
    // Reentrancy
    // ----------------------------------------------------------------

    function test_tip_eth_reentrancy_blocked() public {
        ReentrantRecipient attacker = new ReentrantRecipient(address(registry));
        vm.deal(alice, 2 ether);

        vm.prank(alice);
        vm.expectRevert();
        registry.tip{value: 1 ether}(address(attacker), address(0), 1 ether, "");
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

    function testFuzz_tip_eth_with_fee(uint256 amount) public {
        amount = bound(amount, 1, 100_000 ether);

        vm.deal(alice, amount);

        uint256 expectedFee = (amount * 250) / 10_000;
        uint256 expectedRecipient = amount - expectedFee;

        uint256 bobBalBefore = bob.balance;
        uint256 deployerBalBefore = deployer.balance;

        vm.prank(alice);
        registryWithFees.tip{value: amount}(bob, address(0), amount, "");

        assertEq(bob.balance, bobBalBefore + expectedRecipient);
        assertEq(deployer.balance, deployerBalBefore + expectedFee);
        // Conservation: fee + recipientAmount == amount
        assertEq(expectedFee + expectedRecipient, amount);
    }

    function testFuzz_tip_erc20_with_fee(uint256 amount) public {
        amount = bound(amount, 1, type(uint128).max);

        token.mint(alice, amount);
        vm.prank(alice);
        token.approve(address(registryWithFees), amount);

        uint256 expectedFee = (amount * 250) / 10_000;
        uint256 expectedRecipient = amount - expectedFee;

        uint256 bobBalBefore = token.balanceOf(bob);
        uint256 deployerBalBefore = token.balanceOf(deployer);

        vm.prank(alice);
        registryWithFees.tip(bob, address(token), amount, "");

        assertEq(token.balanceOf(bob), bobBalBefore + expectedRecipient);
        assertEq(token.balanceOf(deployer), deployerBalBefore + expectedFee);
    }

    function testFuzz_register_tier_count(uint8 count) public {
        uint256 n = bound(count, 0, 20);
        CreatorRegistry.PaymentTier[] memory tiers = new CreatorRegistry.PaymentTier[](n);
        for (uint256 i = 0; i < n; ++i) {
            tiers[i] = CreatorRegistry.PaymentTier({
                label: "T",
                amountWei: 1,
                tokenAddress: address(0),
                mode: CreatorRegistry.PaymentMode.TIP
            });
        }

        vm.prank(alice);
        registry.register(METADATA_HASH, tiers);

        CreatorRegistry.Creator memory c = registry.getCreator(alice);
        assertEq(c.tiers.length, n);
    }
}

/**
 * @notice Malicious contract that tries to re-enter tip() on ETH receive.
 */
contract ReentrantRecipient {
    address target;

    constructor(address _target) {
        target = _target;
    }

    receive() external payable {
        // Attempt reentrancy
        CreatorRegistry(target).tip{value: msg.value}(
            address(this), address(0), msg.value, "reenter"
        );
    }
}
