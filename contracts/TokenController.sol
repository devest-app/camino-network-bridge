// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

// Importing the ERC20 token interface from OpenZeppelin
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interface/MintableERC20.sol";

// A contract to manage token transfers, especially for cross-chain operations
contract TokenController {
    
    using SafeERC20 for IERC20;

    // Internal function to transfer tokens or native cryptocurrency (like ETH)
    function __transfer(address receiver, uint256 amount, address token) internal {
        if (token == address(0)) {
            // Check that the sender has sent enough funds for the transfer
            if(receiver == address(this)) {
                require(msg.value >= amount, "Insufficient funds provided (value)");
            } else {
                require(address(this).balance >= amount, "Insufficient funds in contract");
            }

            (bool success, ) = receiver.call{value: amount}(""); 
            require(success, "Transfer failed");
        } else {
            IERC20 _token = IERC20(token);
            if(receiver == address(this)) {
                // Check that sender has enough balance
                uint256 balance = _token.balanceOf(msg.sender);
                require(balance >= amount, "Insufficient balance");
                
                _token.safeTransferFrom(msg.sender, receiver, amount);
            } else {
                uint256 balance = _token.balanceOf(address(this));
                require(balance >= amount, "Insufficient balance");
                _token.safeTransfer(receiver, amount);
            }
        }
    }

    // Internal function to mint tokens
    function __mint(address receiver, uint256 amount, address token) internal {
        MintableERC20 _token = MintableERC20(token);
        _token.mint(receiver, amount);
    }

    // Internal function to burn tokens
    function __burn(address receiver, uint256 amount, address token) internal {
        MintableERC20 _token = MintableERC20(token);
        _token.burnFrom(receiver, amount);
    }

    // Internal function to check if the allowance for a token is sufficient for a transfer
    function __allowance(address account, uint256 amount, address token) internal {
        if (token == address(0)){
            require(account != address(0), 'Invalid sender');
            require(msg.value >= amount, 'Insufficient token submitted');
        } else {
            IERC20 _token = IERC20(token);
            require(_token.allowance(account, address(this)) >= amount, 'Insufficient allowance provided');
        }
    }

    // Internal function to check the balance of an account
    function __balanceOf(address account, address token) internal view returns (uint256) {
        if (token == address(0)) {
            return address(account).balance;
        } else {
            IERC20 _token = IERC20(token);
            return _token.balanceOf(account);
        }
    }

    // Function to receive Ether only allowed when contract Native Token
    receive() external payable {}

    fallback() external payable {}
}
