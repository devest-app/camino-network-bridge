// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

// Import utility functions for string manipulation
import "@openzeppelin/contracts/utils/Strings.sol";
// Import the ERC20 token standard interface
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// Import the TokenController contract to extend its functionalities
import "./TokenController.sol";
import "@openzeppelin/contracts/utils/Context.sol";

// TransferManager extends the TokenController contract
contract TransferManager is TokenController {

    struct DestinationToken {
        address token_out;
        bool active;
        uint256 max_amount;
    }

    // Allowed transfer votes
    mapping (string => bool) public allowedTransferVotes;

    // Mapping to manage allowed transfers between token pairs on different chains
    mapping (uint256 => mapping(address => DestinationToken)) public allowed_transfers;

    // Mapping to track transfer records
    mapping(string => bool) public transfers;

    constructor() {}

    // Internal function to set allowed transfer details for a destination chain and token pair
    function __setAllowedTransfer(uint256 destination_chain, address token_in, address token_out, bool active, uint256 max_amount, string memory nonce) internal {
        require(!allowedTransferVotes[nonce], "Transfer vote already cast");
        allowedTransferVotes[nonce] = true;

        allowed_transfers[destination_chain][token_in] = DestinationToken(token_out, active, max_amount);
    }

    // Function to check if a transfer record exists by its ID
    function getTransfer(string memory transferId) external view returns (bool) {
        return transfers[transferId];
    }

    // Function to retrieve allowed transfer details for a specific destination chain and token pair
    function getAllowedTransfer(uint256 destination_chain, address token_in) external view returns (DestinationToken memory) {
        return allowed_transfers[destination_chain][token_in];
    }

    // Internal function to complete a transfer and create a record for it
    function _completeTransfer(address recipient, uint256 amount, uint256 source_chain, address token_out, string memory nonce) internal {
        string memory transferId = string(abi.encodePacked(Strings.toString(source_chain), nonce));

        require(!transferCompleted(transferId), "Transfer already completed");
        transfers[transferId] = true;

        __transfer(recipient, amount, token_out);

    }

    // Internal function to check if a transfer has been completed
    function transferCompleted(string memory transferId) internal view returns (bool) {
        return transfers[transferId];
    }

    // Internal function to verify if a transfer is allowed based on set parameters
    function isTransferAllowed(uint256 destination_chain, address token_in, address token_out, uint256 amount) internal view returns (bool) {
        DestinationToken memory destination_token = allowed_transfers[destination_chain][token_in];
        return destination_token.active && token_out == destination_token.token_out && amount <= destination_token.max_amount;
    }
}
