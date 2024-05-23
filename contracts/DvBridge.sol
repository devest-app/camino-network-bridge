// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

// Importing ERC20 interface and Context utility from OpenZeppelin
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Context.sol";
// Importing ECDSA utility from OpenZeppelin for cryptographic operations
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
// Importing the SignatureHandler and TransferManager contracts
import "./ValidatorSignatureManager.sol";
import "./TransferManager.sol";

// DvBridge contract inheriting from SignatureHandler, TransferManager, and Context
contract DvBridge is ValidatorSignatureManager, TransferManager, Context {

    bool public active = true;

    // The ID of the chain where the contract is deployed
    uint256 chain_id;

    // The fee to be paid to validators for each transaction
    uint256 public validator_fee;

    // Enable ECDSA operations on bytes32 types
    using ECDSA for bytes32;
    
    // Events for different stages of the cross-chain transfer process
    event TransferInitiated(address sender, address recipient, uint256 amount, uint256 source_chain, uint256 destination_chain, address token_in, address token_out);
    event TransferCompleted(string transfer_id, address msg_sender);

    // Constructor to initialize the contract with chain ID and validators
    constructor(uint256 _chain_id, uint256 _validator_fee, address[] memory validators) ValidatorSignatureManager(validators) {
        chain_id = _chain_id;
        validator_fee = _validator_fee;
    }

    // Initiates a transfer by locking tokens in the contract
    function initiateTransfer(address recipient, uint256 amount, uint256 source_chain, uint256 destination_chain, address token_in, address token_out) public payable returns (bool) {
        // Validation checks for recipient, token addresses, and amount
        require(active, "Contract is not active");
        require(recipient != address(0), "Recipient cannot be zero address");
        require(amount > 0, "Amount cannot be zero");
        require(source_chain == chain_id, "Invalid source chain");

        // Ensure the sender has provided enough allowance and then transfer tokens to the contract
        __allowance(_msgSender(), amount, token_in);
        __transfer(address(this), amount, token_in, true);

        // Emit event for transfer initiation
        emit TransferInitiated(_msgSender(), recipient, amount, source_chain, destination_chain, token_in, token_out);
        
        rewardValidators(validator_fee);

        return true;
    }

    function completeTransfer(address recipient, uint256 amount, uint256 source_chain, uint256 destination_chain, address token_in, address token_out, string memory nonce, bytes[] memory signatures) 
    public payable onlyValidator(_msgSender()) returns (bool) {
        // Validation checks
        require(active, "Contract is not active");
        require(recipient != address(0), "Recipient cannot be zero address");
        require(amount > 0, "Amount cannot be zero");
        require(destination_chain == chain_id, "Invalid destination chain");

        // Generate the message hash and its Ethereum signed message hash variant
        bytes32 message = getTransactionMessage(recipient, amount, source_chain, destination_chain, token_in, token_out, nonce);
        bytes32 ethSignedMessageHash = message.toEthSignedMessageHash();

        // Verify the signatures are from validators
        bool valid = verifySignatures(ethSignedMessageHash, signatures);
        if(!valid) {
            emit SignatureError(_msgSender());
        }
        require(valid, "Invalid signatures");

        // Complete the transfer by sending tokens to the recipient
        _completeTransfer(recipient, amount, source_chain, token_in, token_out, nonce);
        
        return true;
    }

    function voteValidator(uint256 vote_type, address value, bytes[] memory signatures) public payable onlyValidator(_msgSender()) returns (bool) {
        // Validation checks
        require(vote_type == 1 || vote_type == 2, "Invalid vote");

        bytes32 message = getVoteValidatorMessage(vote_type, value);

        // Verify the signatures are from validators
        bool valid = verifySignatures(message, signatures);
        if(!valid) {
            emit SignatureError(_msgSender());
        }
        require(valid, "Invalid signatures");
        
        if(vote_type == 1) {
            // Add the validator to the list of validators
            addValidator(value);
        } else if (vote_type == 2) {
            // Remove the validator from the list of validators
            removeValidator(value);
        }

        return true;
    }

    function changeFee(uint256 new_fee, bytes[] memory signatures) public payable returns (bool) {

        bytes32 message = getVoteRewardMessage(new_fee);

        // Verify the signatures are from validators
        bool valid = verifySignatures(message, signatures);
        if(!valid) {
            emit SignatureError(_msgSender());
        }
        require(valid, "Invalid signatures");

        validator_fee = new_fee;
        return true;
    }

    function setActive(bool _active) public onlyValidator(_msgSender()) {
        active = _active;
    }
}
