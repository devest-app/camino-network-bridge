// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

// Importing ECDSA utility from OpenZeppelin for cryptographic operations
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

// A contract to handle signature verification with a set of validators
contract ValidatorSignatureManager {

    // Enable ECDSA operations on bytes32 types
    using ECDSA for bytes32;

    // Event to indicate a signature error, not used in the provided code
    event SignatureError(address sender);

    // Array to store validator addresses
    address[] validators;

    // Constructor to initialize the contract with a list of validators
    constructor(address[] memory _validators) {
        validators = _validators;
    }

    // Generates a message of transaction details, which can be signed by validators
    function getTransactionMessage(address recipient, uint256 amount, uint256 source_chain, uint256 destionation_chain, address token_in, address token_out, string memory nonce) 
    public pure returns (bytes32) {
        // Encodes transaction details and converts to a bytes32 hash
        return bytesToBytes32(abi.encodePacked(recipient, amount, source_chain, destionation_chain, token_in, token_out, nonce));
    }

    // Generates a message of transaction details, which can be signed by validators
    function getVoteValidatorMessage(uint256 vote_type, address value) 
    public pure returns (bytes32) {
        // Encodes transaction details and converts to a bytes32 hash
        return bytesToBytes32(abi.encodePacked(vote_type, value));
    }

    // Generates a message of transaction details, which can be signed by validators
    function getVoteRewardMessage(uint256 amount) 
    public pure returns (bytes32) {
        // Encodes transaction details and converts to a bytes32 hash
        return bytesToBytes32(abi.encodePacked(amount));
    }

    // Verifies if the provided signatures for a message are valid and from validators
    function verifySignatures(bytes32 message, bytes[] memory signatures) internal view returns (bool) {
        uint256 count = 0; // Counter for valid signatures

        // Loop through each signature, recovering the signer and checking if they're a validator
        for (uint256 i = 0; i < signatures.length; i++) {
            address signer = message.recover(signatures[i]);
            if (isValidator(signer)) {
                count++;
                // If more than half of the validators have signed, return true
                if (count > validators.length / 2) {
                    return true;
                }
            }
        }

        return false; // Not enough valid signatures
    }

    // Distributes the validator fee among the validators
    function rewardValidators(uint256 validator_fee) internal {
        uint256 amount = validator_fee / validators.length;
        uint256 remainder = validator_fee % validators.length;

        for (uint256 i = 0; i < validators.length; i++) {
            payable(validators[i]).transfer(amount);
        }

        payable(msg.sender).transfer(remainder);
    }

    function addValidator(address _address) internal {
        validators.push(_address);
    }

    function removeValidator(address _address) internal {
        for (uint256 i = 0; i < validators.length; i++) {
            if (validators[i] == _address) {
                validators[i] = validators[validators.length - 1];
                validators.pop();
                break;
            }
        }
    }

    function getValidators() public view returns (address[] memory) {
        return validators;
    }

    // Checks if an address is in the list of validators
    function isValidator(address _address) internal view returns (bool) {
        for (uint256 i = 0; i < validators.length; i++) {
            if (validators[i] == _address) {
                return true;
            }
        }
        return false; // Address is not a validator
    }

    // Modifier to restrict function access to validators only
    modifier onlyValidator(address _address) {
        require(isValidator(_address), "Not a validator");
        _;
    }

    // Converts a bytes array to a bytes32 type
    function bytesToBytes32(bytes memory b) private pure returns (bytes32) {
        bytes32 out;

        // Loop through each byte, constructing the bytes32 result
        for (uint i = 0; i < 32; i++) {
            out |= bytes32(b[i] & 0xFF) >> (i * 8);
        }
        return out;
    }

}