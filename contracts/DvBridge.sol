// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;


import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "./SignatureHandler.sol";
import "./TransferManager.sol";


contract DvBridge is SignatureHandler, TransferManager, Context {
    


    uint256 _chain_id;



    // Events
    event TransferInitiated(address sender, address recipient, uint256 amount, uint256 source_chain, uint256 destination_chain, address token_in, address token_out);
    event TransferPrepared(address recipient, uint256 amount, uint256 source_chain, uint256 destination_chain, address token_in, address token_out, uint256 nonce);
    event TransferCompleted(string transfer_id, address msg_sender);


    // Constructor, setup token address and validator addresses
    constructor(uint256 chain_id, address[] memory validators) SignatureHandler(validators){
        _chain_id = chain_id;
    }




    // User transfers founds to the contract, creates a request for transfer to another chain
    
    // Transfer tokens to contract and locks them
    // Emmit event of transfer
    function initiateTransfer(address recipient, uint256 amount, uint256 source_chain, uint256 destination_chain, address token_in, address token_out) public payable returns (bool) {
        
        // recipient cannot be zero address
        require(recipient != address(0), "Recipient cannot be zero address");
        // token_out cannot be zero address
        require(token_out != address(0), "Token out cannot be zero address");
        // amount cannot be zero
        require(amount > 0, "Amount cannot be zero");
        // source chain must be the current chain
        require(source_chain == _chain_id, "Invalid source chain");
    
        // Transfer must be allowed
        require(isTransferAllowed(destination_chain, token_in, token_out), "Transfer not allowed");



        __allowance(_msgSender(), amount, token_in);
        __transfer(address(this), amount, token_in);


        // TODO: Take fees


        // event
        emit TransferInitiated(_msgSender(), recipient, amount, source_chain, destination_chain, token_in, token_out);
        
        return true;
    }



    // Prepare transfer from another chain
    // Emmit event of transfer
    function prepareTransfer(address recipient, uint256 amount, uint256 source_chain, uint256 destination_chain, address token_in, address token_out, uint256 nonce, bytes[] memory signatures) 
    public payable onlyValidator(_msgSender()) returns (bool) {

        // recipient cannot be zero address
        require(recipient != address(0), "Recipient cannot be zero address");
        // token_out cannot be zero address
        require(token_out != address(0), "Token out cannot be zero address");
        // amount cannot be zero
        require(amount > 0, "Amount cannot be zero");
        // destination chain must be the current chain
        require(destination_chain == _chain_id, "Invalid destination chain");


        // check signatures
        bool valid = verifySignatures(recipient, amount, source_chain, destination_chain, token_in, token_out, nonce, signatures);
        if(!valid) {
            emit SignatureError(_msgSender());
        }
        require(valid, "Invalid signatures");

        // create transfer record
        createTransferRecord(recipient, amount, source_chain, token_in, token_out, nonce);        

        // emmmit event of transfer
        emit TransferPrepared(recipient, amount, source_chain, destination_chain, token_in, token_out, nonce);
        
        return true;
    }



    // Transfer tokens from contract address to recipient
    // Emmit event of transfer
    function completeTransfer(string memory transfer_id) public payable onlyValidator(_msgSender()) safeToTransfer(transfer_id) returns (bool) {

        // mark transfer as completed and transfer tokens
        _completeTransfer(transfer_id);

        // emmmit event of transfer
        emit TransferCompleted(transfer_id, _msgSender());
        
        return true;
    }





    function lockTransfer(string memory transfer_id) public payable onlyValidator(_msgSender()) returns (bool) {

        // lock transfer
        _lockTransfer(transfer_id);
    
        return true;
    }

}