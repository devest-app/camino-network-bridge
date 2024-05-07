// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

// Import utility functions for string manipulation
import "@openzeppelin/contracts/utils/Strings.sol";
// Import the ERC20 token standard interface
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// Import the TokenController contract to extend its functionalities
import "./TokenController.sol";

// TransferManager extends the TokenController contract
contract TransferManager is TokenController {

    // Mapping of transfer IDs to their corresponding transfer records
    mapping(string => bool) public transfers;

    // Constructor for the contract
    constructor() {}

    // Function to retrieve a transfer record by its ID
    function getTransfer(string memory transferId) public view returns (bool) {
        return transfers[transferId];
    }
    
    // Internal function to create a record for a transfer
    function _completeTransfer(address recipient, uint256 amount, uint256 source_chain, address token_in, address token_out, string memory nonce) internal {
        // Generate a unique ID for the transfer
        string memory transferId = string(abi.encodePacked(Strings.toString(source_chain), nonce));

        // Ensure no duplicate transfer record exists
        require(!transferCompleted(transferId), "Transfer already completed");

        // Verify that the transfer is allowed
        require(isTransferAllowed(source_chain, token_in, token_out), "Transfer not allowed");

        __transfer(recipient, amount, token_out);

        // Create the transfer record
        transfers[transferId] = true;
    }

    // Check if a transfer is completed
    function transferCompleted(string memory transferId) internal view returns (bool) {
        return transfers[transferId];
    }
}
