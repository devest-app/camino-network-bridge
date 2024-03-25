// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract SignatureHandler {

    using ECDSA for bytes32;

    event SignatureError(address sender);


    address[] validators;

    
    constructor(address[] memory _validators) {
        validators = _validators;
    }
 

 
    // Function used to generate message that will be signed
    function getMessage(address recipient, uint256 amount, uint256 source_chain, uint256 destionation_chain, address token_in, address token_out, uint256 nonce) 
    public pure returns (bytes32) {
        return bytesToBytes32(abi.encodePacked(recipient, amount, source_chain, destionation_chain, token_in, token_out, nonce));
    }

    
    // Function to verify an array of signatures
    function verifySignatures(address recipient, uint256 amount, uint256 source_chain, uint256 destionation_chain, address token_in, address token_out, uint256 nonce, 
    bytes[] memory signatures) internal view returns (bool) {
        
        uint256 count = 0;

        bytes32 message = getMessage(recipient, amount, source_chain, destionation_chain, token_in, token_out, nonce);
        bytes32 ethSignedMessageHash = message.toEthSignedMessageHash();
        
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





    // Function to check if an address is a validator
    function isValidator(address _address) internal view returns (bool) {
        for (uint256 i = 0; i < validators.length; i++) {
            if (validators[i] == _address) {
                return true;
            }
        }

        return false;
    }

    modifier onlyValidator(address _address) {
        require(isValidator(_address), "Not a validator");
        _;
    }






    function bytesToBytes32(bytes memory b) private pure returns (bytes32) {
        bytes32 out;

        for (uint i = 0; i < 32; i++) {
            out |= bytes32(b[i] & 0xFF) >> (i * 8);
        }
        return out;
    }

}