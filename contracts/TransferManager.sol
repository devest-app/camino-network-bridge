// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./TokenController.sol";

contract TransferManager is TokenController {

    uint256 public lock_window = 60000;

    struct TransferRecord {
        address recipient;
        uint256 amount;
        address token_out;
        uint256 source_chain;

        bool locked;
        bool completed;
        uint256 timestamp;
    }


    // Mapping to store transfer records by a unique ID
    mapping(string => TransferRecord) public transfers;

    
    constructor() {
    }


    // Function to get a transfer record state
    function getTransfer(string memory transferId) public view returns (TransferRecord memory) {
        return transfers[transferId];
    }
    
    // Function to record a transfer
    function createTransferRecord(address recipient, uint256 amount, uint256 source_chain, address token_in, address token_out, uint256 nonce) internal {
        
        string memory transferId = string(abi.encodePacked(Strings.toString(source_chain), nonce));

        // Transfer cannot be created if it already exists
        require(transfers[transferId].amount != 0, "TransferRecord already created");

        // Check that allowed transfer exists
        require(allowed_transfers[source_chain][token_in] == token_out, "Transfer not allowed");

        TransferRecord memory _transaction = TransferRecord({
            token_out: token_out,
            recipient: recipient,
            amount: amount,
            source_chain: source_chain,
            locked: false,
            completed: false,
            timestamp: block.timestamp
        });

        transfers[transferId] = _transaction;
    }




    function _completeTransfer(string memory transferId) internal {
        // check if transfer is recorded
        require(transferCreated(transferId), "Transfer not found");
        
        // check if transfer is not locked
        require(!transferLocked(transferId), "Transfer is locked");
        
        // check if transfer is not completed
        require(!transferCompleted(transferId), "Transfer already completed");


        TransferRecord memory _transfer = getTransfer(transferId);
        
        __transfer(_transfer.recipient, _transfer.amount, _transfer.token_out);

        transfers[transferId].completed = true;
    }


    function _lockTransfer(string memory transferId) internal {
        // check if transfer is recorded
        require(transferCreated(transferId), "Transfer not found");
        
        // check if transfer is not locked
        require(!transferLocked(transferId), "Transfer is locked");
        
        // check if transfer is not completed
        require(!transferCompleted(transferId), "Transfer already completed");

        transfers[transferId].locked = true;
    }






    function transferLocked(string memory transferId) internal view returns (bool) {
        return transfers[transferId].locked;
    }

    function transferCompleted(string memory transferId) internal view returns (bool) {
        return transfers[transferId].completed;
    }

    function transferCreated(string memory transferId) internal view returns (bool) {
        return transfers[transferId].amount != 0;
    }






    modifier safeToTransfer(string memory transferId) {
        // check if transfer is recorded
        require(transferCreated(transferId), "Transfer not found");

        // check if transfer is completed
        require(!transferCompleted(transferId), "Transfer already completed");

        // check if transfer is locked
        require(!transferLocked(transferId), "Transfer is locked");


        // check if enough time has passed since the transfer was created
        require(transfers[transferId].timestamp + lock_window < block.timestamp, "Transfer is locked");
        _;
    }

}