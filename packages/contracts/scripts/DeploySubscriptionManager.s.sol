// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {SubscriptionManager} from "../src/SubscriptionManager.sol";

/**
 * @title DeploySubscriptionManager
 * @notice Foundry deployment script for SubscriptionManager.
 *
 * Usage (Base Sepolia):
 *   forge script scripts/DeploySubscriptionManager.s.sol \
 *     --rpc-url base_sepolia \
 *     --broadcast \
 *     --verify
 *
 * Requires DEPLOYER_PRIVATE_KEY in env.
 */
contract DeploySubscriptionManager is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console2.log("Deployer:", deployer);
        console2.log("Chain ID:", block.chainid);

        vm.startBroadcast(deployerKey);

        // Deploy with deployer as fee recipient, zero fee for testnet
        SubscriptionManager manager = new SubscriptionManager(deployer, 0);
        console2.log("SubscriptionManager deployed at:", address(manager));

        // Log configuration
        console2.log("Fee BPS:", manager.feeBps());
        console2.log("Fee recipient:", manager.feeRecipient());

        vm.stopBroadcast();
    }
}
