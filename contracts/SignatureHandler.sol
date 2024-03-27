// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

// Importing ECDSA utility from OpenZeppelin for cryptographic operations
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

// A contract to handle signature verification with a set of validators
contract SignatureHandler {
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

    // Generates a hash of transaction details, which can be signed by validators
    function getMessage(address recipient, uint256 amount, uint256 source_chain, uint256 destionation_chain, address token_in, address token_out, uint256 nonce) 
    public pure returns (bytes32) {
        // Encodes transaction details and converts to a bytes32 hash
        return bytesToBytes32(abi.encodePacked(recipient, amount, source_chain, destionation_chain, token_in, token_out, nonce));
    }

    // Verifies if the provided signatures for a message are valid and from validators
    function verifySignatures(address recipient, uint256 amount, uint256 source_chain, uint256 destionation_chain, address token_in, address token_out, uint256 nonce, 
    bytes[] memory signatures) internal view returns (bool) {
        uint256 count = 0; // Counter for valid signatures

        // Generate the message hash and its Ethereum signed message hash variant
        bytes32 message = getMessage(recipient, amount, source_chain, destionation_chain, token_in, token_out, nonce);
        bytes32 ethSignedMessageHash = message.toEthSignedMessageHash();

        // Loop through each signature, recovering the signer and checking if they're a validator
        for (uint256 i = 0; i < signatures.length; i++) {
            address signer = ethSignedMessageHash.recover(signatures[i]);
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