// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {CreatorRegistry} from "../src/CreatorRegistry.sol";

/**
 * @title Deploy
 * @notice Foundry deployment script for CreatorRegistry.
 *
 * Usage (Base Sepolia):
 *   forge script scripts/Deploy.s.sol \
 *     --rpc-url base_sepolia \
 *     --broadcast \
 *     --verify
 *
 * Requires DEPLOYER_PRIVATE_KEY in env.
 */
contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console2.log("Deployer:", deployer);
        console2.log("Chain ID:", block.chainid);

        vm.startBroadcast(deployerKey);

        // Deploy with deployer as fee recipient, zero fee for Phase 1
        CreatorRegistry registry = new CreatorRegistry(deployer, 0);
        console2.log("CreatorRegistry deployed at:", address(registry));

        // Smoke test: register the deployer as a creator to confirm events emit
        CreatorRegistry.PaymentTier[] memory tiers = new CreatorRegistry.PaymentTier[](1);
        tiers[0] = CreatorRegistry.PaymentTier({
            label: "Coffee",
            amountWei: 0.001 ether,
            tokenAddress: address(0),
            mode: CreatorRegistry.PaymentMode.TIP
        });
        registry.register("bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi", tiers);
        console2.log("Smoke test: deployer registered as creator");

        vm.stopBroadcast();
    }
}
