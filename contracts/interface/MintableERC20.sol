// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

// Interface for mintable ERC20 tokens
interface MintableERC20 {
    function mint(address to, uint256 amount) external;
    function burn(uint256 amount) external;
}