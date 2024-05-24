// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

// Importing necessary libraries and contracts
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./ValidatorSignatureManager.sol";
import "./TransferManager.sol";

// DvBridge contract handles cross-chain transfers and validator management
contract DvBridge is ValidatorSignatureManager, TransferManager, Context {

    uint256 public lock_time; // Time until the bridge is locked for transfers to non-validators
    uint256 chain_id; // ID of the current chain
    uint256 public validator_fee; // Fee paid to validators per transaction

    using ECDSA for bytes32; // Enable ECDSA operations on bytes32 types
    
    // Events for different stages of the transfer process
    event TransferInitiated(address sender, address recipient, uint256 amount, uint256 source_chain, uint256 destination_chain, address token_in, address token_out);
    event TransferCompleted(address recipient, uint256 amount, uint256 source_chain, uint256 destination_chain, address token_in, address token_out, string nonce, bytes[] signatures, address msg_sender);
    event BridgeLocked(uint256 lock_time);

    // Constructor to initialize the contract with chain ID, validator fee, and validators
    constructor(uint256 _chain_id, uint256 _validator_fee, address[] memory validators) ValidatorSignatureManager(validators) {
        chain_id = _chain_id;
        validator_fee = _validator_fee;
    }

    // Initiates a transfer by locking tokens in the contract
    function initiateTransfer(address recipient, uint256 amount, uint256 source_chain, uint256 destination_chain, address token_in, address token_out) public payable returns (bool) {
        // Validation checks
        require(recipient != address(0), "Recipient cannot be zero address");
        require(amount > 0, "Amount cannot be zero");
        require(source_chain == chain_id, "Invalid source chain");
        require(destination_chain != chain_id, "Invalid destination chain");
        require(isTransferAllowed(destination_chain, token_in, token_out, amount), "Transfer not allowed or amount exceeds maximum allowed");
        
        if(lock_time > block.timestamp) {
            revert("Bridge is locked for transfers");
        }

        // Transfer tokens to the contract
        __allowance(_msgSender(), amount, token_in);
        __transfer(address(this), amount, token_in, true);

        // Emit event for transfer initiation
        emit TransferInitiated(_msgSender(), recipient, amount, source_chain, destination_chain, token_in, token_out);
        
        // Reward validators
        rewardValidators(validator_fee);

        return true;
    }

    // Completes a transfer by sending tokens to the recipient
    function completeTransfer(address recipient, uint256 amount, uint256 source_chain, uint256 destination_chain, address token_in, address token_out, string memory nonce, bytes[] memory signatures) 
    public payable onlyValidator(_msgSender()) returns (bool) {
        // Validation checks
        require(recipient != address(0), "Recipient cannot be zero address");
        require(amount > 0, "Amount cannot be zero");
        require(destination_chain == chain_id, "Invalid destination chain");
        require(source_chain != chain_id, "Invalid source chain");

        if(lock_time > block.timestamp) {
            require(isValidator(recipient), "Recipient is not a validator");
        } else {
            require(isTransferAllowed(destination_chain, token_in, token_out, amount), "Transfer not allowed or amount exceeds maximum allowed");
        }

        // Verify signatures
        bytes32 message = getTransactionMessage(recipient, amount, source_chain, destination_chain, token_in, token_out, nonce);
        bytes32 ethSignedMessageHash = message.toEthSignedMessageHash();
        bool valid = verifySignatures(ethSignedMessageHash, signatures);
        if(!valid) {
            emit SignatureError(_msgSender());
        }
        require(valid, "Invalid signatures");

        // Complete the transfer
        _completeTransfer(recipient, amount, source_chain, token_in, token_out, nonce);
        emit TransferCompleted(recipient, amount, source_chain, destination_chain, token_in, token_out, nonce, signatures, _msgSender());

        return true;
    }

    // Locks the bridge for transfers to non-validators for a specified time
    function lock() public onlyValidator(_msgSender()) {
        lock_time = block.timestamp + 1 days;
        emit BridgeLocked(lock_time);
    }

    // Handles validator voting for adding or removing validators
    function voteValidator(uint256 vote_type, address value, bytes[] memory signatures) public payable onlyValidator(_msgSender()) returns (bool) {
        require(vote_type == 1 || vote_type == 2, "Invalid vote");

        bytes32 message = getVoteValidatorMessage(vote_type, value);
        bool valid = verifySignatures(message, signatures);
        if(!valid) {
            emit SignatureError(_msgSender());
        }
        require(valid, "Invalid signatures");
        
        if(vote_type == 1) {
            addValidator(value); // Add validator
        } else if (vote_type == 2) {
            removeValidator(value); // Remove validator
        }

        return true;
    }

    // Sets allowed transfer parameters for a specific destination chain and token
    function setAllowedTransfer(uint256 destination_chain, address token_in, address token_out, bool active, uint256 max_amount) onlyValidator(_msgSender()) public {
        __setAllowedTransfer(destination_chain, token_in, token_out, active, max_amount);
    }

    // Sets the validator reward fee
    function setValidatorReward(uint256 new_fee, bytes[] memory signatures) public payable returns (bool) {
        bytes32 message = getVoteRewardMessage(new_fee);
        bool valid = verifySignatures(message, signatures);
        if(!valid) {
            emit SignatureError(_msgSender());
        }
        require(valid, "Invalid signatures");

        validator_fee = new_fee;
        return true;
    }
}
