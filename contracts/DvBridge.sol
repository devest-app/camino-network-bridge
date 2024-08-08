// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

// Importing necessary libraries and contracts
import "./ValidatorSignatureManager.sol";
import "./TransferManager.sol";


// DvBridge contract handles cross-chain transfers and validator management
contract DvBridge is ValidatorSignatureManager, TransferManager {

    bool public locked; // Time until the bridge is locked for transfers to non-validators
    uint256 public validator_fee; // Fee that validators receive for completing transfers (each of the validators gets the same amount)

    mapping (string => bool) validatorFeeAndLockVotes;

    using ECDSA for bytes32; // Enable ECDSA operations on bytes32 types
    
    // Events for different stages of the transfer process
    event TransferInitiated(address sender, address recipient, uint256 amount, uint256 source_chain, uint256 destination_chain, address token_in, address token_out);
    event TransferCompleted(address recipient, uint256 amount, uint256 source_chain, uint256 destination_chain, address token_in, address token_out, string nonce, bytes[] signatures, address msg_sender);
    event TransferBlocked(uint256 source_chain, uint256 destination_chain, string nonce, bytes[] signatures);
    event FundsRecovered(address recipient, uint256 amount, uint256 source_chain, uint256 destination_chain, address token_in, string nonce, bytes[] signatures);

    // Constructor to initialize the contract with chain ID, validator fee, and validators
    constructor(uint256 _chain_id, uint256 _validator_fee, address[] memory validators) ValidatorSignatureManager(validators, _chain_id) {
        validator_fee = _validator_fee;
    }

    // Initiates a transfer by locking tokens in the contract
    function initiateTransfer(address recipient, uint256 amount, uint256 source_chain, uint256 destination_chain, address token_in, address token_out) public payable returns (bool) {
        // Validation checks
        require(recipient != address(0), "Recipient cannot be zero address");
        require(amount > 0, "Amount cannot be zero");
        require(source_chain == chain_id, "Invalid source chain");
        require(destination_chain != chain_id, "Invalid destination chain");
        require(isTransferAllowed(source_chain, destination_chain, token_in, token_out, amount), "Transfer not allowed or amount exceeds maximum allowed");
        require(!locked, "Bridge is locked");

        // Check that the user has sent enough funds for the transfer and validator fees
        uint256 total_amount;
        if(token_in == address(0)) {
            total_amount = amount + (validator_fee * validators.length);
            require(msg.value >= total_amount, "Insufficient funds provided (value)");
        } else {
            total_amount = (validator_fee * validators.length);
            require(msg.value >= total_amount, "Insufficient funds provided (value)");
        }
        
        uint256 balance_before = __balanceOf(address(this), token_in);

        // Transfer tokens to the contract
        __allowance(msg.sender, amount, token_in);
        __transfer(address(this), amount, token_in);

        uint256 balance_after = __balanceOf(address(this), token_in);

        // Check for amount of tokens transferred (in case of ERC20 tokens with transfer fees)
        uint256 transfered_amount;
        if(token_in == address(0)) {
            transfered_amount = amount;
        } else {
            transfered_amount = balance_after - balance_before;
        }

        require(transfered_amount > 0, "No tokens transferred");

        // Reward validators
        rewardValidators(validator_fee);

        // return excess funds to the sender
        if(msg.value > total_amount) {
            (bool success, ) = msg.sender.call{value: msg.value - total_amount}("");
            require(success, "Transfer failed");
        }

        // Emit event for transfer initiation
        emit TransferInitiated(msg.sender, recipient, transfered_amount, source_chain, destination_chain, token_in, token_out);

        return true;
    }

    // Completes a transfer by sending tokens to the recipient
    function completeTransfer(address recipient, uint256 amount, uint256 source_chain, uint256 destination_chain, address token_in, address token_out, string memory nonce, bytes[] memory signatures) 
    public payable onlyValidator(msg.sender) returns (bool) {
        // Validation checks
        require(recipient != address(0), "Recipient cannot be zero address");
        require(amount > 0, "Amount cannot be zero");
        require(destination_chain == chain_id, "Invalid destination chain");
        require(source_chain != chain_id, "Invalid source chain");

        if(locked) {
            require(isValidator(recipient), "Recipient is not a validator");
        } else {
            require(isTransferAllowed(source_chain, destination_chain, token_in, token_out, amount), "Transfer not allowed or amount exceeds maximum allowed");
        }

        // Verify signatures
        bytes32 message = getTransactionMessage(recipient, amount, source_chain, destination_chain, token_in, token_out, nonce);
        bool valid = verifySignatures(message, signatures);
        require(valid, "Invalid signatures");

        // Complete the transfer
        _completeTransfer(recipient, amount, source_chain, token_out, nonce);
        emit TransferCompleted(recipient, amount, source_chain, destination_chain, token_in, token_out, nonce, signatures, msg.sender);

        return true;
    }

    // Handles validator voting for adding or removing validators
    function voteValidator(uint256 vote_type, address value, string memory nonce,  bytes[] memory signatures) public payable onlyValidator(msg.sender) returns (bool) {
        require(vote_type == 1 || vote_type == 2, "Invalid vote");
        bytes32 message = getVoteValidatorMessage(vote_type, value, nonce);
        bool valid = verifySignatures(message, signatures);
        require(valid, "Invalid signatures");

        if(vote_type == 1) {
            addValidator(value, nonce); // Add validator
        } else if (vote_type == 2) {
            removeValidator(value, nonce); // Remove validator
        }

        return true;
    }

    // Sets allowed transfer parameters for a specific destination chain and token
    function setAllowedTransfer(uint256 source_chain, uint256 destination_chain, address token_in, address token_out, bool active, uint256 max_amount, string memory nonce, bytes[] memory signatures) onlyValidator(msg.sender) public {
        bytes32 message = getAllowedTransferMessage(source_chain, destination_chain, token_in, token_out, active, max_amount, nonce);
        bool valid = verifySignatures(message, signatures);
        require(valid, "Invalid signatures");

        __setAllowedTransfer(source_chain, destination_chain, token_in, token_out, active, max_amount, nonce);
    }

    // Sets the validator reward fee
    function modifyRewardsAndLock(uint256 new_fee, bool lock, string memory nonce, bytes[] memory signatures) onlyValidator(msg.sender) public payable returns (bool) {
        require(!validatorFeeAndLockVotes[nonce], "Vote already cast");
        
        bytes32 message = getRewardLockMessage(new_fee, lock, nonce);
        bool valid = verifySignatures(message, signatures);
        require(valid, "Invalid signatures");

        validatorFeeAndLockVotes[nonce] = true;
        validator_fee = new_fee;
        locked = lock;

        return true;
    }

    // Function to recover funds in case of failed transfers on the destination chain (refunds tokens on the source chain)
    function recoverFunds(address recipient, uint256 amount, uint256 source_chain, uint256 destination_chain, address token_in, string memory nonce, bytes[] memory signatures) onlyValidator(msg.sender) public returns (bool)  {
        require(recipient != address(0), "Recipient cannot be zero address");
        require(amount > 0, "Amount cannot be zero");
        require(source_chain == chain_id, "Invalid source chain");
        require(destination_chain != chain_id, "Invalid destination chain");

        bytes32 message = getRecoverFundsMessage(recipient, amount, source_chain, destination_chain, token_in, nonce);
        bool valid = verifySignatures(message, signatures);
        require(valid, "Invalid signatures");

        _recoverFunds(recipient, amount, source_chain, token_in, nonce);

        emit FundsRecovered(recipient, amount, source_chain, destination_chain, token_in, nonce, signatures);

        return true;
    }

    // Function to block a transfer in case of issues on the destination chain or other reasons (eg. blocks the transfer on the destination chain to prevent double spending before refunding on the source chain)
    function blockTransfer(uint256 source_chain, uint256 destination_chain, string memory nonce, bytes[] memory signatures) onlyValidator(msg.sender) public returns (bool)  {
        require(destination_chain == chain_id, "Invalid destination chain");
        require(source_chain != chain_id, "Invalid source chain");

        bytes32 message = getBlockTransferMessage(source_chain, destination_chain, nonce);
        bool valid = verifySignatures(message, signatures);
        require(valid, "Invalid signatures");

        _blockTransfer(source_chain, nonce);

        emit TransferBlocked(source_chain, destination_chain, nonce, signatures);

        return true;
    }
}
