// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;


import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@devest/contracts/VestingToken.sol";
import "./SignatureHandler.sol";
import "./TransferRecords.sol";


contract DvBridge is VestingToken, SignatureHandler, TransferRecords, Context {
    
    uint256 _chain_id;

    // Events
    event TransferInitiated(address from, address to, uint256 value, string chain_id, address token);
    event TransferCompleted(address to, uint256 value);


    // Constructor, setup token address and validator addresses
    constructor(uint256 chain_id, address tokenAddress, address[] memory validators) VestingToken(tokenAddress) SignatureHandler(validators){
        _chain_id = chain_id;
    }



    // Transfer tokens to contract and locks them
    // Emmit event of transfer
    function initiateTransfer(address recipient, uint256 amount, string memory chain_id, address token) public payable returns (bool) {

        __allowance(_msgSender(), amount);
        __transferFrom(_msgSender(), address(this), amount);

        // emmmit event of transfer
        emit TransferInitiated(_msgSender(), recipient, amount, chain_id, token);
        
        return true;
    }

    // Transfer tokens from contract address to recipient
    // Emmit event of transfer
    function completeTransfer(address recipient, uint256 amount, uint256 chainId, string memory blockNumber, uint256 nonce, bytes[] memory signatures) public payable correctChainID(chainId) returns (bool) {
        
        // check signatures
        bool valid = verifySignatures(recipient, amount, chainId, blockNumber, nonce, signatures);
        if(!valid) {
            emit SignatureError("Invalid signatures", _msgSender());
        }
        require(valid, "Invalid signatures");

        string memory record_id = string(abi.encodePacked(Strings.toString(chainId), blockNumber));

        // check if transfer is recorded
        require(!isTransferRecorded(record_id), "Transfer already processed");

        // __transfer(recipient, amount);

        // save transfer record
        recordTransfer(record_id);
        
        // emmmit event of transfer
        emit TransferCompleted(recipient, amount);
        
        return true;
    }


    modifier correctChainID(uint256 chainId) {
        require(chainId == _chain_id, "Invalid chain id");
        _;
    }

}