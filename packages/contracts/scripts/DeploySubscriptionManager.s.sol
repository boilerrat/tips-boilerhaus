// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {SubscriptionManager} from "../src/SubscriptionManager.sol";

/**
 * @title DeploySubscriptionManager
 * @notice Foundry deployment script for SubscriptionManager.
 *
 * Usage (Base mainnet):
 *   FEE_RECIPIENT=0x... FEE_BPS=100 forge script scripts/DeploySubscriptionManager.s.sol \
 *     --rpc-url base_mainnet \
 *     --broadcast \
 *     --verify
 *
 * Usage (Base Sepolia, zero fee):
 *   forge script scripts/DeploySubscriptionManager.s.sol \
 *     --rpc-url base_sepolia \
 *     --broadcast \
 *     --verify
 *
 * Requires DEPLOYER_PRIVATE_KEY in env.
 * Optional: FEE_RECIPIENT (defaults to deployer), FEE_BPS (defaults to 0).
 */
contract DeploySubscriptionManager is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        // Fee recipient defaults to deployer if not set
        address feeRecipient = vm.envOr("FEE_RECIPIENT", deployer);
        uint256 feeBps = vm.envOr("FEE_BPS", uint256(0));

        console2.log("Deployer:", deployer);
        console2.log("Chain ID:", block.chainid);
        console2.log("Fee recipient:", feeRecipient);
        console2.log("Fee BPS:", feeBps);

        vm.startBroadcast(deployerKey);

        SubscriptionManager manager = new SubscriptionManager(feeRecipient, feeBps);
        console2.log("SubscriptionManager deployed at:", address(manager));

        vm.stopBroadcast();
    }
}
