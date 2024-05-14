// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

// Importing the ERC20 token interface from OpenZeppelin
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// A contract to manage token transfers, especially for cross-chain operations
contract TokenController {

    // Internal function to transfer tokens or native cryptocurrency (like ETH)
    // `receiver` is the address to receive the tokens or ETH
    // `amount` specifies how much to transfer
    // `token` address is used to distinguish between ETH (address(0)) and an ERC20 token
    function __transfer(address receiver, uint256 amount, address token) internal {
        if (token == address(0)){
            require(msg.value >= (amount), "Insufficient funds provided (value)");
            // Send ETH
            payable(receiver).transfer(amount);
        } else {
            // Send ERC20 token
            IERC20 _token = IERC20(token);
            // Check balance first
            uint256 balance = _token.balanceOf(address(this));
            require(balance >= amount, "Insufficient balance");

            // Perform the transfer
            require(_token.transfer(receiver, amount), "Transfer failed");
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

    // Function to receive Ether only allowed when contract Native Token
    receive() external payable {}
}
