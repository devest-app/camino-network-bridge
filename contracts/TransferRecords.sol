// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

contract TransferRecords {

    // Mapping to store transfer records by a unique ID
    mapping(string => bool) public transfers;

    // Event to log when a transfer is recorded
    event TransferRecorded(string transferId, address sender, string recipientAddress, uint256 amount);

    // Function to record a transfer
    function recordTransfer(string memory transferId) internal {
        require(!transfers[transferId], "Transfer already processed");

        transfers[transferId] = true;
    }

    // Function to check if a transfer has been recorded
    function isTransferRecorded(string memory transferId) public view returns (bool) {
        return transfers[transferId];
    }
}