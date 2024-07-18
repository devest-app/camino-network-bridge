// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

// A contract to handle signature verification with a set of validators
contract ValidatorSignatureManager {

    mapping (string => bool) validatorVotes;

    using ECDSA for bytes32;

    address[] validators;

    // Constructor to initialize the contract with a list of validators
    constructor(address[] memory _validators) {
        validators = _validators;
    }

    // Generates a message of transaction details
    function getTransactionMessage(address recipient, uint256 amount, uint256 source_chain, uint256 destination_chain, address token_in, address token_out, string memory nonce) 
    public pure returns (bytes32) {
        return keccak256(abi.encodePacked(recipient, amount, source_chain, destination_chain, token_in, token_out, nonce, "1"));
    }

    // Generates a message of transaction details
    function getRecoverFundsMessage(address recipient, uint256 amount, uint256 source_chain, uint256 destination_chain, address token_in, string memory nonce) 
    public pure returns (bytes32) {
        return keccak256(abi.encodePacked(recipient, amount, source_chain, destination_chain, token_in, nonce, "2"));
    }

    // Generates a message for blocking transfers
    function getBlockTransferMessage(uint256 source_chain, uint256 destination_chain, string memory nonce) 
    public pure returns (bytes32) {
        return keccak256(abi.encodePacked(source_chain, destination_chain, nonce, "3"));
    }

    // Generates a message for validator vote
    function getVoteValidatorMessage(uint256 vote_type, address value, string memory nonce) 
    public pure returns (bytes32) {
        return keccak256(abi.encodePacked(vote_type, value, nonce));
    }

    // Generates a message for reward vote
    function getVoteRewardMessage(uint256 amount, string memory nonce) 
    public pure returns (bytes32) {
        return keccak256(abi.encodePacked(amount, nonce));
    }

    // Generates a message for setting allowed transfers
    function getAllowedTransferMessage(uint256 source_chain,uint256 destination_chain, address token_in, address token_out, bool active, uint256 max_amount, string memory nonce) 
    public pure returns (bytes32) {
        return keccak256(abi.encodePacked(source_chain, destination_chain, token_in, token_out, active, max_amount, nonce));
    }

    // Generates a message for setting allowed transfers
    function getLockMessage(string memory nonce) 
    public pure returns (bytes32) {
        return keccak256(abi.encodePacked(nonce));
    }

    // Verifies if the provided signatures are valid and from validators
    function verifySignatures(bytes32 messageHash, bytes[] memory signatures) internal view returns (bool) {
        uint256 count = 0;
        address[] memory uniqueSigners = new address[](signatures.length);

        // Turn the message into an eth signed message
        bytes32 message = messageHash.toEthSignedMessageHash();
        
        // Check that the number of signatures is not greater than the number of validators
        require(signatures.length <= validators.length, "Too many signatures provided");

        // Check all signatures
        for (uint256 i = 0; i < signatures.length; i++) {
            
            // Get the signature signer
            address signer = message.recover(signatures[i]);

            // Check if the signer has only signature
            for(uint256 j = 0; j < uniqueSigners.length; j++) {
                if(uniqueSigners[j] == signer) {
                    return false;
                }
            }

            uniqueSigners[i] = signer;

            // Check that the signer is a validator
            if (isValidator(signer)) {
                count++;
                if (count > validators.length / 2) {
                    return true;
                }
            }
        }
        return false;
    }

    // Distributes the validator fee among the validators
    function rewardValidators(uint256 validator_fee) internal {
        uint256 amount = validator_fee * validators.length;
        require(msg.value >= amount, "Insufficient funds provided");

        for (uint256 i = 0; i < validators.length; i++) {
            (bool success, ) = validators[i].call{value: validator_fee}(""); 
            if (!success) {
                revert("Transfer failed");
            }
        }
    }

    // Adds a new validator
    function addValidator(address _address, string memory nonce) internal {
        require(!validatorVotes[nonce], "Already voted");
        validatorVotes[nonce] = true;

        // Check that the validator is not already in the list
        for (uint256 i = 0; i < validators.length; i++) {
            require(validators[i] != _address, "Validator already exists");
        }

        validators.push(_address);
    }

    // Removes an existing validator
    function removeValidator(address _address, string memory nonce) internal {
        require(!validatorVotes[nonce], "Already voted");
        validatorVotes[nonce] = true;

        for (uint256 i = 0; i < validators.length; i++) {
            if (validators[i] == _address) {
                validators[i] = validators[validators.length - 1];
                validators.pop();
                break;
            }
        }
    }

    // Returns the list of validators
    function getValidators() external view returns (address[] memory) {
        return validators;
    }

    // Checks if an address is a validator
    function isValidator(address _address) internal view returns (bool) {
        for (uint256 i = 0; i < validators.length; i++) {
            if (validators[i] == _address) {
                return true;
            }
        }
        return false;
    }

    // Modifier to restrict access to validators only
    modifier onlyValidator(address _address) {
        require(isValidator(_address), "Not a validator");
        _;
    }

}
