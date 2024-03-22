// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract SignatureHandler {
    using ECDSA for bytes32;

    event SignatureError(string message, address signer);


    address[] validators;

    
    constructor(address[] memory _validators) {
        validators = _validators;
    }

    
    // Function to receive an array of signatures
    function verifySignatures(address _to, uint256 _amount, uint256 _chainId, string memory _blockNumber, uint256 _nonce, bytes[] memory signatures) internal view returns (bool) {
        
        uint256 count = 0;

        bytes32 messageHash = getMessageHash(_to, _amount, _chainId, _blockNumber, _nonce);
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
        
        // Ensure at least half of the validators have signed
        for (uint256 i = 0; i < signatures.length; i++) {
            address signer = ethSignedMessageHash.recover(signatures[i]);
            if (isValidator(signer)) {
                count++;
                if (count > validators.length / 2) {
                    return true;
                }
            }
        }

        return false;
    }

    function getMessageHash(address _to, uint256 _amount, uint256 _chainId, string memory _blockNumber, uint256 _nonce) public pure returns (bytes32) {
            string memory _message = string(abi.encodePacked(Strings.toString(_chainId), _blockNumber));
            return keccak256(abi.encodePacked(_to, _amount, _message, _nonce));
    }

    // Function to check if an address is a validator
    function isValidator(address _address) internal view returns (bool) {
        for (uint256 i = 0; i < validators.length; i++) {
            if (validators[i] == _address) {
                return true;
            }
        }

        return false;
    }
}