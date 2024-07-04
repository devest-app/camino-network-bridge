// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

// Importing necessary libraries and contracts
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./ValidatorSignatureManager.sol";
import "./TransferManager.sol";


// DvBridge contract handles cross-chain transfers and validator management
contract DvBridge is ValidatorSignatureManager, TransferManager, Context {

    uint256 public lock_time; // Time until the bridge is locked for transfers to non-validators
    uint256 chain_id; // ID of the current chain
    uint256 public validator_fee; // Fee that validators receive for completing transfers (each of the validators gets the same amount)

    mapping (string => bool) validatorFeeVotes;
    mapping (string => bool) lockVotes;

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
        require(lock_time < block.timestamp, "Bridge is locked");

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
        __allowance(_msgSender(), amount, token_in);
        __transfer(address(this), amount, token_in);

        uint256 balance_after = __balanceOf(address(this), token_in);

        // Check for amount of tokens transferred (in case of ERC20 tokens with tranfer fees)
        uint256 transfered_amount;
        if(token_in == address(0)) {
            transfered_amount = amount;
        } else {
            transfered_amount = balance_after - balance_before;
        }

        // Reward validators
        rewardValidators(validator_fee);

        // return excess funds to the sender
        if(msg.value > total_amount) {
            (bool success, ) = _msgSender().call{value: msg.value - total_amount}("");
            require(success, "Transfer failed");
        }

        // Emit event for transfer initiation
        emit TransferInitiated(_msgSender(), recipient, transfered_amount, source_chain, destination_chain, token_in, token_out);

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
        bool valid = verifySignatures(message, signatures);
        require(valid, "Invalid signatures");

        // Complete the transfer
        _completeTransfer(recipient, amount, source_chain, token_out, nonce);
        emit TransferCompleted(recipient, amount, source_chain, destination_chain, token_in, token_out, nonce, signatures, _msgSender());

        return true;
    }

    // Locks the bridge for transfers to non-validators for a specified time
    function lock(string memory nonce, bytes[] memory signatures) public onlyValidator(_msgSender()) {
        require(!lockVotes[nonce], "Vote already cast");

        // Verify signatures
        bytes32 message = getLockMessage(nonce);
        bool valid = verifySignatures(message, signatures);
        require(valid, "Invalid signatures");

        lockVotes[nonce] = true;

        lock_time = block.timestamp + 1 days;
        emit BridgeLocked(lock_time);
    }

    // Handles validator voting for adding or removing validators
    function voteValidator(uint256 vote_type, address value, string memory nonce,  bytes[] memory signatures) public payable onlyValidator(_msgSender()) returns (bool) {
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
    function setAllowedTransfer(uint256 destination_chain, address token_in, address token_out, bool active, uint256 max_amount, string memory nonce, bytes[] memory signatures) onlyValidator(_msgSender()) public {
        bytes32 message = getAllowedTransferMessage(destination_chain, token_in, token_out, active, max_amount, nonce);(destination_chain, token_in, token_out, active, max_amount, nonce);
        bool valid = verifySignatures(message, signatures);
        require(valid, "Invalid signatures");

        __setAllowedTransfer(destination_chain, token_in, token_out, active, max_amount, nonce);
    }

    // Sets the validator reward fee
    function setValidatorReward(uint256 new_fee, string memory nonce, bytes[] memory signatures) onlyValidator(_msgSender()) public payable returns (bool) {
        require(!validatorFeeVotes[nonce], "Vote already cast");
        
        bytes32 message = getVoteRewardMessage(new_fee, nonce);
        bool valid = verifySignatures(message, signatures);
        require(valid, "Invalid signatures");

        validatorFeeVotes[nonce] = true;
        validator_fee = new_fee;

        return true;
    }
}
