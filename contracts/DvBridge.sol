// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

// Importing ERC20 interface and Context utility from OpenZeppelin
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Context.sol";
// Importing the SignatureHandler and TransferManager contracts
import "./SignatureHandler.sol";
import "./TransferManager.sol";

// DvBridge contract inheriting from SignatureHandler, TransferManager, and Context
contract DvBridge is SignatureHandler, TransferManager, Context {
    
    // The ID of the chain where the contract is deployed
    uint256 _chain_id;

    // Events for different stages of the cross-chain transfer process
    event TransferInitiated(address sender, address recipient, uint256 amount, uint256 source_chain, uint256 destination_chain, address token_in, address token_out);
    event TransferPrepared(address recipient, uint256 amount, uint256 source_chain, uint256 destination_chain, address token_in, address token_out, uint256 nonce);
    event TransferCompleted(string transfer_id, address msg_sender);

    // Constructor to initialize the contract with chain ID and validators
    constructor(uint256 chain_id, address[] memory validators) SignatureHandler(validators) {
        _chain_id = chain_id;
    }

    // Initiates a transfer by locking tokens in the contract
    function initiateTransfer(address recipient, uint256 amount, uint256 source_chain, uint256 destination_chain, address token_in, address token_out) public payable returns (bool) {
        // Validation checks for recipient, token addresses, and amount
        require(recipient != address(0), "Recipient cannot be zero address");
        require(token_out != address(0), "Token out cannot be zero address");
        require(amount > 0, "Amount cannot be zero");
        require(source_chain == _chain_id, "Invalid source chain");
        require(isTransferAllowed(destination_chain, token_in, token_out), "Transfer not allowed");

        // Ensure the sender has provided enough allowance and then transfer tokens to the contract
        __allowance(_msgSender(), amount, token_in);
        __transfer(address(this), amount, token_in);

        // TODO: Implement fee handling

        // Emit event for transfer initiation
        emit TransferInitiated(_msgSender(), recipient, amount, source_chain, destination_chain, token_in, token_out);
        
        return true;
    }

    // Prepares a transfer from another chain with validators' signatures
    function prepareTransfer(address recipient, uint256 amount, uint256 source_chain, uint256 destination_chain, address token_in, address token_out, uint256 nonce, bytes[] memory signatures) 
    public payable onlyValidator(_msgSender()) returns (bool) {
        // Validation checks
        require(recipient != address(0), "Recipient cannot be zero address");
        require(token_out != address(0), "Token out cannot be zero address");
        require(amount > 0, "Amount cannot be zero");
        require(destination_chain == _chain_id, "Invalid destination chain");

        // Verify the signatures are from validators
        bool valid = verifySignatures(recipient, amount, source_chain, destination_chain, token_in, token_out, nonce, signatures);
        require(valid, "Invalid signatures");
        if(!valid) {
            emit SignatureError(_msgSender());
        }

        // Create a transfer record
        createTransferRecord(recipient, amount, source_chain, token_in, token_out, nonce);        

        // Emit event for transfer preparation
        emit TransferPrepared(recipient, amount, source_chain, destination_chain, token_in, token_out, nonce);
        
        return true;
    }

    // Completes a transfer by sending tokens to the recipient
    function completeTransfer(string memory transfer_id) public payable onlyValidator(_msgSender()) safeToTransfer(transfer_id) returns (bool) {
        // Complete the transfer and mark it as such
        _completeTransfer(transfer_id);

        // Emit event for transfer completion
        emit TransferCompleted(transfer_id, _msgSender());
        
        return true;
    }

    // Locks a transfer, preventing it from being completed
    function lockTransfer(string memory transfer_id) public payable onlyValidator(_msgSender()) returns (bool) {
        // Lock the transfer
        _lockTransfer(transfer_id);
    
        return true;
    }
}
