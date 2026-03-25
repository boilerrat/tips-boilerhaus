// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {SubscriptionManager} from "../src/SubscriptionManager.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

/**
 * @title SubscriptionManagerTest
 * @notice Foundry tests for SubscriptionManager covering subscription lifecycle,
 *         renewals, plan changes, fee mechanics, cancellation, reentrancy guards,
 *         and edge cases.
 */
contract SubscriptionManagerTest is Test {
    SubscriptionManager public manager;
    SubscriptionManager public managerWithFees;
    MockERC20 public token;

    address deployer = makeAddr("deployer");
    address alice = makeAddr("alice"); // subscriber
    address bob = makeAddr("bob"); // creator
    address charlie = makeAddr("charlie"); // keeper
    address dave = makeAddr("dave"); // another creator

    uint256 constant MONTHLY = 30 days; // 2592000
    uint256 constant WEEKLY = 7 days; // 604800
    uint256 constant YEARLY = 365 days; // 31536000
    uint256 constant SUB_AMOUNT = 10e18; // 10 tokens per period

    function setUp() public {
        vm.prank(deployer);
        manager = new SubscriptionManager(deployer, 0);

        // Manager with 2.5% fee for fee-path testing
        vm.prank(deployer);
        managerWithFees = new SubscriptionManager(deployer, 250);

        token = new MockERC20("Test Token", "TST", 18);
    }

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------

    /// @dev Fund alice with tokens and approve the manager contract.
    function _fundAndApprove(address target, uint256 amount) internal {
        token.mint(alice, amount);
        vm.prank(alice);
        token.approve(target, amount);
    }

    /// @dev Create a standard monthly subscription from alice to bob.
    function _createSubscription() internal returns (uint256) {
        _fundAndApprove(address(manager), SUB_AMOUNT * 12);

        vm.prank(alice);
        return manager.subscribe(bob, address(token), SUB_AMOUNT, MONTHLY);
    }

    /// @dev Create a subscription on the fee-enabled manager.
    function _createSubscriptionWithFees() internal returns (uint256) {
        _fundAndApprove(address(managerWithFees), SUB_AMOUNT * 12);

        vm.prank(alice);
        return managerWithFees.subscribe(bob, address(token), SUB_AMOUNT, MONTHLY);
    }

    // ----------------------------------------------------------------
    // Constructor
    // ----------------------------------------------------------------

    function test_constructor_sets_immutables() public view {
        assertEq(manager.feeBps(), 0);
        assertEq(manager.feeRecipient(), deployer);
        assertEq(managerWithFees.feeBps(), 250);
    }

    function test_constructor_revert_zero_address() public {
        vm.expectRevert(SubscriptionManager.ZeroAddress.selector);
        new SubscriptionManager(address(0), 0);
    }

    function test_constructor_revert_fee_too_high() public {
        vm.expectRevert(SubscriptionManager.FeeTooHigh.selector);
        new SubscriptionManager(deployer, 501);
    }

    function test_constructor_max_fee_ok() public {
        SubscriptionManager m = new SubscriptionManager(deployer, 500);
        assertEq(m.feeBps(), 500);
    }

    // ----------------------------------------------------------------
    // Subscribe
    // ----------------------------------------------------------------

    function test_subscribe_success() public {
        _fundAndApprove(address(manager), SUB_AMOUNT * 12);

        vm.expectEmit(true, true, true, true);
        emit SubscriptionManager.SubscriptionCreated(0, alice, bob, address(token), SUB_AMOUNT, MONTHLY);

        vm.prank(alice);
        uint256 id = manager.subscribe(bob, address(token), SUB_AMOUNT, MONTHLY);

        assertEq(id, 0);

        SubscriptionManager.Subscription memory sub = manager.getSubscription(id);
        assertEq(sub.id, 0);
        assertEq(sub.subscriber, alice);
        assertEq(sub.creator, bob);
        assertEq(sub.token, address(token));
        assertEq(sub.amountPerPeriod, SUB_AMOUNT);
        assertEq(sub.periodSeconds, MONTHLY);
        assertEq(sub.startTimestamp, block.timestamp);
        assertEq(sub.lastPaidTimestamp, block.timestamp);
        assertTrue(sub.active);
        assertEq(sub.pendingAmount, 0);
        assertEq(sub.pendingPeriod, 0);
    }

    function test_subscribe_pulls_first_payment() public {
        _fundAndApprove(address(manager), SUB_AMOUNT * 12);

        uint256 bobBalBefore = token.balanceOf(bob);
        uint256 aliceBalBefore = token.balanceOf(alice);

        vm.prank(alice);
        manager.subscribe(bob, address(token), SUB_AMOUNT, MONTHLY);

        assertEq(token.balanceOf(bob), bobBalBefore + SUB_AMOUNT);
        assertEq(token.balanceOf(alice), aliceBalBefore - SUB_AMOUNT);
    }

    function test_subscribe_increments_id() public {
        _fundAndApprove(address(manager), SUB_AMOUNT * 24);

        vm.prank(alice);
        uint256 id1 = manager.subscribe(bob, address(token), SUB_AMOUNT, MONTHLY);

        vm.prank(alice);
        uint256 id2 = manager.subscribe(dave, address(token), SUB_AMOUNT, MONTHLY);

        assertEq(id1, 0);
        assertEq(id2, 1);
        assertEq(manager.nextSubscriptionId(), 2);
    }

    function test_subscribe_updates_index_arrays() public {
        _fundAndApprove(address(manager), SUB_AMOUNT * 24);

        vm.prank(alice);
        manager.subscribe(bob, address(token), SUB_AMOUNT, MONTHLY);

        vm.prank(alice);
        manager.subscribe(dave, address(token), SUB_AMOUNT, MONTHLY);

        uint256[] memory aliceSubs = manager.getSubscriptionsBySubscriber(alice);
        assertEq(aliceSubs.length, 2);
        assertEq(aliceSubs[0], 0);
        assertEq(aliceSubs[1], 1);

        uint256[] memory bobSubs = manager.getSubscriptionsByCreator(bob);
        assertEq(bobSubs.length, 1);
        assertEq(bobSubs[0], 0);

        uint256[] memory daveSubs = manager.getSubscriptionsByCreator(dave);
        assertEq(daveSubs.length, 1);
        assertEq(daveSubs[0], 1);
    }

    function test_subscribe_revert_zero_creator() public {
        _fundAndApprove(address(manager), SUB_AMOUNT);

        vm.prank(alice);
        vm.expectRevert(SubscriptionManager.InvalidRecipient.selector);
        manager.subscribe(address(0), address(token), SUB_AMOUNT, MONTHLY);
    }

    function test_subscribe_revert_self_subscribe() public {
        _fundAndApprove(address(manager), SUB_AMOUNT);

        vm.prank(alice);
        vm.expectRevert(SubscriptionManager.InvalidRecipient.selector);
        manager.subscribe(alice, address(token), SUB_AMOUNT, MONTHLY);
    }

    function test_subscribe_revert_zero_token() public {
        vm.prank(alice);
        vm.expectRevert(SubscriptionManager.ZeroAddress.selector);
        manager.subscribe(bob, address(0), SUB_AMOUNT, MONTHLY);
    }

    function test_subscribe_revert_zero_amount() public {
        vm.prank(alice);
        vm.expectRevert(SubscriptionManager.ZeroAmount.selector);
        manager.subscribe(bob, address(token), 0, MONTHLY);
    }

    function test_subscribe_revert_period_too_short() public {
        _fundAndApprove(address(manager), SUB_AMOUNT);

        vm.prank(alice);
        vm.expectRevert(SubscriptionManager.InvalidPeriod.selector);
        manager.subscribe(bob, address(token), SUB_AMOUNT, 86_399); // 1 second less than 1 day
    }

    function test_subscribe_revert_period_too_long() public {
        _fundAndApprove(address(manager), SUB_AMOUNT);

        vm.prank(alice);
        vm.expectRevert(SubscriptionManager.InvalidPeriod.selector);
        manager.subscribe(bob, address(token), SUB_AMOUNT, 31_536_001); // 1 second more than 365 days
    }

    function test_subscribe_min_period_ok() public {
        _fundAndApprove(address(manager), SUB_AMOUNT);

        vm.prank(alice);
        uint256 id = manager.subscribe(bob, address(token), SUB_AMOUNT, 86_400);

        SubscriptionManager.Subscription memory sub = manager.getSubscription(id);
        assertEq(sub.periodSeconds, 86_400);
    }

    function test_subscribe_max_period_ok() public {
        _fundAndApprove(address(manager), SUB_AMOUNT);

        vm.prank(alice);
        uint256 id = manager.subscribe(bob, address(token), SUB_AMOUNT, 31_536_000);

        SubscriptionManager.Subscription memory sub = manager.getSubscription(id);
        assertEq(sub.periodSeconds, 31_536_000);
    }

    function test_subscribe_revert_insufficient_allowance() public {
        token.mint(alice, SUB_AMOUNT);
        // No approval

        vm.prank(alice);
        vm.expectRevert();
        manager.subscribe(bob, address(token), SUB_AMOUNT, MONTHLY);
    }

    function test_subscribe_revert_insufficient_balance() public {
        // Approve but don't have balance
        vm.prank(alice);
        token.approve(address(manager), SUB_AMOUNT);

        vm.prank(alice);
        vm.expectRevert();
        manager.subscribe(bob, address(token), SUB_AMOUNT, MONTHLY);
    }

    // ----------------------------------------------------------------
    // Subscribe with fees
    // ----------------------------------------------------------------

    function test_subscribe_with_fee_first_payment() public {
        _fundAndApprove(address(managerWithFees), SUB_AMOUNT * 12);

        uint256 expectedFee = (SUB_AMOUNT * 250) / 10_000;
        uint256 expectedCreator = SUB_AMOUNT - expectedFee;

        uint256 bobBalBefore = token.balanceOf(bob);
        uint256 deployerBalBefore = token.balanceOf(deployer);

        vm.prank(alice);
        managerWithFees.subscribe(bob, address(token), SUB_AMOUNT, MONTHLY);

        assertEq(token.balanceOf(bob), bobBalBefore + expectedCreator);
        assertEq(token.balanceOf(deployer), deployerBalBefore + expectedFee);
    }

    function test_subscribe_with_fee_event_emits_net() public {
        _fundAndApprove(address(managerWithFees), SUB_AMOUNT * 12);

        uint256 expectedFee = (SUB_AMOUNT * 250) / 10_000;
        uint256 expectedCreator = SUB_AMOUNT - expectedFee;

        // SubscriptionRenewed event should emit creatorAmount, not gross
        vm.expectEmit(true, true, true, true);
        emit SubscriptionManager.SubscriptionRenewed(0, alice, bob, expectedCreator, block.timestamp);

        vm.prank(alice);
        managerWithFees.subscribe(bob, address(token), SUB_AMOUNT, MONTHLY);
    }

    // ----------------------------------------------------------------
    // Renewal
    // ----------------------------------------------------------------

    function test_processRenewal_success() public {
        uint256 id = _createSubscription();

        // Advance time past one period
        vm.warp(block.timestamp + MONTHLY);

        uint256 bobBalBefore = token.balanceOf(bob);

        vm.expectEmit(true, true, true, true);
        emit SubscriptionManager.SubscriptionRenewed(id, alice, bob, SUB_AMOUNT, block.timestamp);

        vm.prank(charlie); // keeper
        manager.processRenewal(id);

        assertEq(token.balanceOf(bob), bobBalBefore + SUB_AMOUNT);

        SubscriptionManager.Subscription memory sub = manager.getSubscription(id);
        assertEq(sub.lastPaidTimestamp, block.timestamp);
    }

    function test_processRenewal_revert_too_early() public {
        uint256 id = _createSubscription();

        // Advance time but not enough
        vm.warp(block.timestamp + MONTHLY - 1);

        vm.prank(charlie);
        vm.expectRevert(SubscriptionManager.RenewalTooEarly.selector);
        manager.processRenewal(id);
    }

    function test_processRenewal_revert_cancelled() public {
        uint256 id = _createSubscription();

        vm.prank(alice);
        manager.cancel(id);

        vm.warp(block.timestamp + MONTHLY);

        vm.prank(charlie);
        vm.expectRevert(SubscriptionManager.SubscriptionNotActive.selector);
        manager.processRenewal(id);
    }

    function test_processRenewal_multiple_periods() public {
        uint256 id = _createSubscription();

        // Advance 3 months — only 1 renewal should succeed per call
        vm.warp(block.timestamp + MONTHLY * 3);

        uint256 bobBalBefore = token.balanceOf(bob);

        vm.prank(charlie);
        manager.processRenewal(id);

        assertEq(token.balanceOf(bob), bobBalBefore + SUB_AMOUNT);

        // Second renewal should succeed (still past due)
        vm.prank(charlie);
        vm.expectRevert(SubscriptionManager.RenewalTooEarly.selector);
        manager.processRenewal(id);
    }

    function test_processRenewal_anyone_can_call() public {
        uint256 id = _createSubscription();
        vm.warp(block.timestamp + MONTHLY);

        // Random address can process renewal
        address randomKeeper = makeAddr("randomKeeper");
        vm.prank(randomKeeper);
        manager.processRenewal(id);

        SubscriptionManager.Subscription memory sub = manager.getSubscription(id);
        assertEq(sub.lastPaidTimestamp, block.timestamp);
    }

    function test_processRenewal_with_fee() public {
        uint256 id = _createSubscriptionWithFees();

        vm.warp(block.timestamp + MONTHLY);

        uint256 expectedFee = (SUB_AMOUNT * 250) / 10_000;
        uint256 expectedCreator = SUB_AMOUNT - expectedFee;

        uint256 bobBalBefore = token.balanceOf(bob);
        uint256 deployerBalBefore = token.balanceOf(deployer);

        vm.prank(charlie);
        managerWithFees.processRenewal(id);

        assertEq(token.balanceOf(bob), bobBalBefore + expectedCreator);
        assertEq(token.balanceOf(deployer), deployerBalBefore + expectedFee);
    }

    function test_processRenewal_reverts_insufficient_balance() public {
        uint256 id = _createSubscription();

        // Drain alice's remaining tokens
        uint256 remaining = token.balanceOf(alice);
        vm.prank(alice);
        token.transfer(dave, remaining);

        vm.warp(block.timestamp + MONTHLY);

        vm.prank(charlie);
        vm.expectRevert();
        manager.processRenewal(id);

        // Subscription should still be active (graceful failure)
        SubscriptionManager.Subscription memory sub = manager.getSubscription(id);
        assertTrue(sub.active);
    }

    // ----------------------------------------------------------------
    // Update (plan change)
    // ----------------------------------------------------------------

    function test_updateSubscription_success() public {
        uint256 id = _createSubscription();

        uint256 newAmount = 20e18;
        uint256 newPeriod = WEEKLY;

        vm.expectEmit(true, true, false, true);
        emit SubscriptionManager.SubscriptionUpdated(id, alice, newAmount, newPeriod);

        vm.prank(alice);
        manager.updateSubscription(id, newAmount, newPeriod);

        SubscriptionManager.Subscription memory sub = manager.getSubscription(id);
        // Current values unchanged
        assertEq(sub.amountPerPeriod, SUB_AMOUNT);
        assertEq(sub.periodSeconds, MONTHLY);
        // Pending values set
        assertEq(sub.pendingAmount, newAmount);
        assertEq(sub.pendingPeriod, newPeriod);
    }

    function test_updateSubscription_applied_at_renewal() public {
        uint256 id = _createSubscription();

        uint256 newAmount = 20e18;
        uint256 newPeriod = WEEKLY;

        vm.prank(alice);
        manager.updateSubscription(id, newAmount, newPeriod);

        // Fund alice with more tokens for the higher amount
        token.mint(alice, 100e18);
        vm.prank(alice);
        token.approve(address(manager), 100e18);

        vm.warp(block.timestamp + MONTHLY);

        uint256 bobBalBefore = token.balanceOf(bob);

        vm.prank(charlie);
        manager.processRenewal(id);

        // Payment should be at the NEW amount
        assertEq(token.balanceOf(bob), bobBalBefore + newAmount);

        SubscriptionManager.Subscription memory sub = manager.getSubscription(id);
        assertEq(sub.amountPerPeriod, newAmount);
        assertEq(sub.periodSeconds, newPeriod);
        assertEq(sub.pendingAmount, 0);
        assertEq(sub.pendingPeriod, 0);
    }

    function test_updateSubscription_revert_not_subscriber() public {
        uint256 id = _createSubscription();

        vm.prank(bob); // bob is the creator, not subscriber
        vm.expectRevert(SubscriptionManager.NotSubscriber.selector);
        manager.updateSubscription(id, 20e18, WEEKLY);
    }

    function test_updateSubscription_revert_cancelled() public {
        uint256 id = _createSubscription();

        vm.prank(alice);
        manager.cancel(id);

        vm.prank(alice);
        vm.expectRevert(SubscriptionManager.SubscriptionNotActive.selector);
        manager.updateSubscription(id, 20e18, WEEKLY);
    }

    function test_updateSubscription_revert_zero_amount() public {
        uint256 id = _createSubscription();

        vm.prank(alice);
        vm.expectRevert(SubscriptionManager.ZeroAmount.selector);
        manager.updateSubscription(id, 0, WEEKLY);
    }

    function test_updateSubscription_revert_invalid_period() public {
        uint256 id = _createSubscription();

        vm.prank(alice);
        vm.expectRevert(SubscriptionManager.InvalidPeriod.selector);
        manager.updateSubscription(id, 20e18, 86_399);

        vm.prank(alice);
        vm.expectRevert(SubscriptionManager.InvalidPeriod.selector);
        manager.updateSubscription(id, 20e18, 31_536_001);
    }

    function test_updateSubscription_overwrite_pending() public {
        uint256 id = _createSubscription();

        vm.prank(alice);
        manager.updateSubscription(id, 20e18, WEEKLY);

        // Overwrite with a different plan change
        vm.prank(alice);
        manager.updateSubscription(id, 5e18, YEARLY);

        SubscriptionManager.Subscription memory sub = manager.getSubscription(id);
        assertEq(sub.pendingAmount, 5e18);
        assertEq(sub.pendingPeriod, YEARLY);
    }

    // ----------------------------------------------------------------
    // Cancel
    // ----------------------------------------------------------------

    function test_cancel_success() public {
        uint256 id = _createSubscription();

        vm.expectEmit(true, true, true, true);
        emit SubscriptionManager.SubscriptionCancelled(id, alice, bob, block.timestamp);

        vm.prank(alice);
        manager.cancel(id);

        SubscriptionManager.Subscription memory sub = manager.getSubscription(id);
        assertFalse(sub.active);
        // Data preserved
        assertEq(sub.subscriber, alice);
        assertEq(sub.creator, bob);
    }

    function test_cancel_clears_pending_update() public {
        uint256 id = _createSubscription();

        vm.prank(alice);
        manager.updateSubscription(id, 20e18, WEEKLY);

        vm.prank(alice);
        manager.cancel(id);

        SubscriptionManager.Subscription memory sub = manager.getSubscription(id);
        assertEq(sub.pendingAmount, 0);
        assertEq(sub.pendingPeriod, 0);
    }

    function test_cancel_revert_not_subscriber() public {
        uint256 id = _createSubscription();

        vm.prank(bob);
        vm.expectRevert(SubscriptionManager.NotSubscriber.selector);
        manager.cancel(id);
    }

    function test_cancel_revert_already_cancelled() public {
        uint256 id = _createSubscription();

        vm.prank(alice);
        manager.cancel(id);

        vm.prank(alice);
        vm.expectRevert(SubscriptionManager.SubscriptionNotActive.selector);
        manager.cancel(id);
    }

    // ----------------------------------------------------------------
    // Views
    // ----------------------------------------------------------------

    function test_getSubscription_nonexistent_returns_empty() public view {
        SubscriptionManager.Subscription memory sub = manager.getSubscription(999);
        assertEq(sub.subscriber, address(0));
        assertEq(sub.creator, address(0));
        assertFalse(sub.active);
    }

    function test_getSubscriptionsBySubscriber_empty() public view {
        uint256[] memory subs = manager.getSubscriptionsBySubscriber(alice);
        assertEq(subs.length, 0);
    }

    function test_getSubscriptionsByCreator_empty() public view {
        uint256[] memory subs = manager.getSubscriptionsByCreator(bob);
        assertEq(subs.length, 0);
    }

    // ----------------------------------------------------------------
    // Full lifecycle
    // ----------------------------------------------------------------

    function test_full_lifecycle_subscribe_renew_update_renew_cancel() public {
        // Subscribe
        uint256 id = _createSubscription();
        assertEq(token.balanceOf(bob), SUB_AMOUNT);

        // First renewal
        vm.warp(block.timestamp + MONTHLY);
        vm.prank(charlie);
        manager.processRenewal(id);
        assertEq(token.balanceOf(bob), SUB_AMOUNT * 2);

        // Schedule plan change (upgrade to 20 tokens)
        uint256 newAmount = 20e18;
        vm.prank(alice);
        manager.updateSubscription(id, newAmount, MONTHLY);

        // Fund alice for the higher amount
        token.mint(alice, 100e18);
        vm.prank(alice);
        token.approve(address(manager), 100e18);

        // Second renewal — plan change applied
        vm.warp(block.timestamp + MONTHLY);
        vm.prank(charlie);
        manager.processRenewal(id);
        assertEq(token.balanceOf(bob), SUB_AMOUNT * 2 + newAmount);

        // Cancel
        vm.prank(alice);
        manager.cancel(id);

        // Renewal after cancel should fail
        vm.warp(block.timestamp + MONTHLY);
        vm.prank(charlie);
        vm.expectRevert(SubscriptionManager.SubscriptionNotActive.selector);
        manager.processRenewal(id);

        // Data preserved after cancel
        SubscriptionManager.Subscription memory sub = manager.getSubscription(id);
        assertFalse(sub.active);
        assertEq(sub.subscriber, alice);
        assertEq(sub.creator, bob);
        assertEq(sub.amountPerPeriod, newAmount); // reflects the upgrade
    }

    function test_multiple_subscribers_same_creator() public {
        _fundAndApprove(address(manager), SUB_AMOUNT * 12);

        vm.prank(alice);
        uint256 id1 = manager.subscribe(bob, address(token), SUB_AMOUNT, MONTHLY);

        // Dave subscribes to bob
        address subscriber2 = makeAddr("subscriber2");
        token.mint(subscriber2, SUB_AMOUNT * 12);
        vm.prank(subscriber2);
        token.approve(address(manager), SUB_AMOUNT * 12);

        vm.prank(subscriber2);
        uint256 id2 = manager.subscribe(bob, address(token), SUB_AMOUNT * 2, MONTHLY);

        uint256[] memory bobSubs = manager.getSubscriptionsByCreator(bob);
        assertEq(bobSubs.length, 2);
        assertEq(bobSubs[0], id1);
        assertEq(bobSubs[1], id2);
    }

    // ----------------------------------------------------------------
    // Reentrancy
    // ----------------------------------------------------------------

    function test_subscribe_reentrancy_blocked() public {
        ReentrantToken reentrantToken = new ReentrantToken(address(manager), bob);
        reentrantToken.mint(alice, SUB_AMOUNT * 12);
        vm.prank(alice);
        reentrantToken.approve(address(manager), SUB_AMOUNT * 12);

        vm.prank(alice);
        vm.expectRevert();
        manager.subscribe(bob, address(reentrantToken), SUB_AMOUNT, MONTHLY);
    }

    // ----------------------------------------------------------------
    // Fuzz tests
    // ----------------------------------------------------------------

    function testFuzz_subscribe_amount(uint256 amount) public {
        amount = bound(amount, 1, type(uint128).max);

        token.mint(alice, amount);
        vm.prank(alice);
        token.approve(address(manager), amount);

        vm.prank(alice);
        uint256 id = manager.subscribe(bob, address(token), amount, MONTHLY);

        SubscriptionManager.Subscription memory sub = manager.getSubscription(id);
        assertEq(sub.amountPerPeriod, amount);
        assertEq(token.balanceOf(bob), amount);
    }

    function testFuzz_subscribe_period(uint256 period) public {
        period = bound(period, 86_400, 31_536_000);

        _fundAndApprove(address(manager), SUB_AMOUNT);

        vm.prank(alice);
        uint256 id = manager.subscribe(bob, address(token), SUB_AMOUNT, period);

        SubscriptionManager.Subscription memory sub = manager.getSubscription(id);
        assertEq(sub.periodSeconds, period);
    }

    function testFuzz_renewal_with_fee(uint256 amount) public {
        amount = bound(amount, 1, type(uint128).max);

        token.mint(alice, amount * 2);
        vm.prank(alice);
        token.approve(address(managerWithFees), amount * 2);

        vm.prank(alice);
        uint256 id = managerWithFees.subscribe(bob, address(token), amount, MONTHLY);

        uint256 expectedFee = (amount * 250) / 10_000;
        uint256 expectedCreator = amount - expectedFee;

        // First payment already pulled
        assertEq(token.balanceOf(bob), expectedCreator);
        assertEq(token.balanceOf(deployer), expectedFee);

        vm.warp(block.timestamp + MONTHLY);

        uint256 bobBalBefore = token.balanceOf(bob);
        uint256 deployerBalBefore = token.balanceOf(deployer);

        vm.prank(charlie);
        managerWithFees.processRenewal(id);

        assertEq(token.balanceOf(bob), bobBalBefore + expectedCreator);
        assertEq(token.balanceOf(deployer), deployerBalBefore + expectedFee);

        // Conservation: fee + creatorAmount == amount
        assertEq(expectedFee + expectedCreator, amount);
    }

    function testFuzz_update_subscription(uint256 newAmount, uint256 newPeriod) public {
        newAmount = bound(newAmount, 1, type(uint128).max);
        newPeriod = bound(newPeriod, 86_400, 31_536_000);

        uint256 id = _createSubscription();

        vm.prank(alice);
        manager.updateSubscription(id, newAmount, newPeriod);

        SubscriptionManager.Subscription memory sub = manager.getSubscription(id);
        assertEq(sub.pendingAmount, newAmount);
        assertEq(sub.pendingPeriod, newPeriod);
    }
}

/**
 * @notice Malicious ERC-20 that attempts reentrancy on transferFrom.
 */
contract ReentrantToken {
    address target;
    address creator;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    bool private _attacking;

    constructor(address _target, address _creator) {
        target = _target;
        creator = _creator;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "insufficient balance");
        require(allowance[from][msg.sender] >= amount, "insufficient allowance");

        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;

        // Attempt reentrancy on first transfer
        if (!_attacking) {
            _attacking = true;
            SubscriptionManager(target).subscribe(creator, address(this), amount, 86_400);
        }

        return true;
    }
}
