// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

// Importing the ERC20 token interface from OpenZeppelin
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// A contract to manage token transfers, especially for cross-chain operations
contract TokenController {

    // Mapping to manage allowed transfers between token pairs on different chains
    mapping (uint256 => mapping(address => address)) public allowed_transfers;

    // The constructor is empty and can be omitted for simplicity
    constructor(){}

    // Allows the addition of new token pairs for cross-chain transfers
    // `chain_id` represents the target blockchain
    // `token_in` is the token address on the current chain
    // `token_out` is the corresponding token address on the target chain
    function addAllowedTransfer(uint256 chain_id, address token_in, address token_out) public {
        allowed_transfers[chain_id][token_in] = token_out;
    }

    // Checks if a specified token transfer is allowed based on previously added pairs
    function isTransferAllowed(uint256 chain_id, address token_in, address token_out) public view returns (bool) {
        return allowed_transfers[chain_id][token_in] == token_out;
    }

    // Internal function to transfer tokens or native cryptocurrency (like ETH)
    // `receiver` is the address to receive the tokens or ETH
    // `amount` specifies how much to transfer
    // `token` address is used to distinguish between ETH (address(0)) and an ERC20 token
    function __transfer(address receiver, uint256 amount, address token) internal {
        if (token == address(0)){
            // Send ETH
            payable(receiver).transfer(amount);
        } else {
            // Send ERC20 token
            IERC20 _token = IERC20(token);
            // Note: Error handling for transfer should be added
            _token.transfer(receiver, amount);
        }
    }

    // Internal function to get the balance of a token or ETH for a specific account
    function __balanceOf(address account, address token) internal view returns (uint256) {
        if (token == address(0)){
            // Return ETH balance
            return address(account).balance;
        } else {
            // Return ERC20 token balance
            IERC20 _token = IERC20(token);
            return _token.balanceOf(account);
        }
    }

    // Internal function to check if the allowance for a token is sufficient for a transfer
    // `account` is the token owner
    // `amount` is the token quantity to check allowance for
    // `token` distinguishes between ETH (address(0)) and an ERC20 token
    function __allowance(address account, uint256 amount, address token) internal {
        if (token == address(0)){
            // For ETH, ensure non-zero account and sufficient ETH is sent
            require(account != address(0), 'Invalid sender');
            require(msg.value >= amount, 'Insufficient token submitted');
        } else {
            // For ERC20 tokens, check the allowance
            IERC20 _token = IERC20(token);
            require(_token.allowance(account, address(this)) >= amount, 'Insufficient allowance provided');
        }
    }

}
