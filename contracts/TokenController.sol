// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TokenController {

    // Mapping to store available cross-chain transfers ( chain_id => (token_in => token_out)
    mapping (uint256 => mapping(address => address)) public allowed_transfers;

    constructor(){}



    // Function that adds a new token pair to the allowed transfers
    function addAllowedTransfer(uint256 chain_id, address token_in, address token_out) public {
        allowed_transfers[chain_id][token_in] = token_out;
    }


    // Function that checks if a transfer is allowed
    function isTransferAllowed(uint256 chain_id, address token_in, address token_out) public view returns (bool) {
        return allowed_transfers[chain_id][token_in] == token_out;
    }



    

    /**
     *  Internal token transfer
     */
    function __transfer(address receiver, uint256 amount, address token) internal {
        if (token == address(0)){
            payable(receiver).transfer(amount);
        } else {
            IERC20 _token = IERC20(token);

            // TODO: Add error handling for transfer

            _token.transfer(receiver, amount);
        }
    }


    /**
     *  Internal token balance
    */
    function __balanceOf(address account, address token) internal view returns (uint256) {
        if (token == address(0)){
            return address(account).balance;
        } else {
            IERC20 _token = IERC20(token);
            return _token.balanceOf(account);
        }
    }

    /**
     *  Internal token allowance
     */
    function __allowance(address account, uint256 amount, address token) internal {
        if (token == address(0)){
            require(account != address(0), 'Invalid sender');
            require(msg.value >= amount, 'Insufficient token submitted');
        } else {
            IERC20 _token = IERC20(token);
            require(_token.allowance(account, address(this)) >= amount, 'Insufficient allowance provided');
        }
    }

}
