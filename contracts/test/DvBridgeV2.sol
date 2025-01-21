// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../DvBridge.sol";

contract DvBridgeV2 is DvBridge {
    // Add new state variables here if needed
    string public version;

    // Add new functions or override existing ones
    function initialize2() public reinitializer(2) {
        version = "2.0";
        // If you need to initialize new state variables
        // Note: Don't call the original initialize() as it's already been called
    }

    function getVersion() public view returns (string memory) {
        return version;
    }

    // Add new functionality here
} 