// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

// Import the TokenController contract to extend its functionalities
import "./TokenController.sol";

// TransferManager extends the TokenController contract
contract TransferManager is TokenController {

    struct DestinationToken {
        address token_out;
        bool active;
        uint256 max_amount;
    }

    // Allowed transfer votes
    mapping (string => bool) public allowedTransferVotes;
    // Mintable token votes
    mapping (string => bool) public mintableTokenVotes;

    // Mintable token types
    mapping (address => bool) public mintable_tokens;
    // Mapping to manage allowed transfers between token pairs on different chains
    mapping (uint256 => mapping(uint256 => mapping(address => DestinationToken))) public allowed_transfers;

    // Mapping to track transfer records
    mapping(bytes => bool) public transfers;

    constructor() {}

    // Internal function to set allowed transfer details for a destination chain and token pair
    function __setAllowedTransfer(uint256 source_chain, uint256 destination_chain, address token_in, address token_out, bool active, uint256 max_amount, string memory nonce) internal {
        require(!allowedTransferVotes[nonce], "Transfer vote already cast");
        allowedTransferVotes[nonce] = true;

        allowed_transfers[source_chain][destination_chain][token_in] = DestinationToken(token_out, active, max_amount);
    }

    function __setMintableToken(address token, bool mintable, string memory nonce) internal {
        require(!mintableTokenVotes[nonce], "Mintable token vote already cast");
        mintableTokenVotes[nonce] = true;

        mintable_tokens[token] = mintable;
    }

    // Function to check if a transfer record exists by its ID
    function getTransfer(bytes memory transferId) external view returns (bool) {
        return transfers[transferId];
    }

    // Function to retrieve allowed transfer details for a specific destination chain and token pair
    function getAllowedTransfer(uint256 source_chain, uint256 destination_chain, address token_in) external view returns (DestinationToken memory) {
        return allowed_transfers[source_chain][destination_chain][token_in];
    }

    // Internal function to complete a transfer and create a record for it
    function _completeTransfer(address recipient, uint256 amount, uint256 source_chain, address token_out, string memory nonce) internal {
        bytes memory transferId = abi.encodePacked(source_chain, nonce);

        require(!transfers[transferId], "Transfer already completed");
        transfers[transferId] = true;

        // Check if the token is mintable
        if(mintable_tokens[token_out]) {
            __mint(recipient, amount, token_out);
        } else {
            __transfer(recipient, amount, token_out);
        }
    }

    function _recoverFunds(address recipient, uint256 amount, uint256 source_chain, address token_in, string memory nonce) internal {
        bytes memory transferId = abi.encodePacked(source_chain, nonce, recipient);

        require(!transfers[transferId], "Transfer already completed");
        transfers[transferId] = true;

        // Check if the token is mintable
        if(mintable_tokens[token_in]) {
            __mint(recipient, amount, token_in);
        } else {
            __transfer(recipient, amount, token_in);
        }
    }

    function _blockTransfer(uint256 source_chain, string memory nonce) internal {
        bytes memory transferId = abi.encodePacked(source_chain, nonce);

        require(!transfers[transferId], "Transfer already blocked");
        transfers[transferId] = true;
    }

    // Internal function to verify if a transfer is allowed based on set parameters
    function isTransferAllowed(uint256 source_chain, uint256 destination_chain, address token_in, address token_out, uint256 amount) internal view returns (bool) {
        DestinationToken memory destination_token = allowed_transfers[source_chain][destination_chain][token_in];
        return destination_token.active && token_out == destination_token.token_out && amount <= destination_token.max_amount;
    }
}
