// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

// Import utility functions for string manipulation
import "@openzeppelin/contracts/utils/Strings.sol";
// Import the ERC20 token standard interface
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// Import the TokenController contract to extend its functionalities
import "./TokenController.sol";

// TransferManager extends the TokenController contract
contract TransferManager is TokenController {

    // Define the time window for a transfer to be locked or completed
    uint256 public lock_window = 60000;

    // Struct to store the details of a transfer
    struct TransferRecord {
        address recipient; // Address of the recipient
        uint256 amount; // Amount of tokens to be transferred
        address token_out; // Token address on the destination chain
        uint256 source_chain; // Source chain ID

        bool locked; // Whether the transfer is locked
        bool completed; // Whether the transfer is completed
        uint256 timestamp; // Timestamp of the transfer creation
    }

    // Mapping of transfer IDs to their corresponding transfer records
    mapping(string => TransferRecord) public transfers;

    // Constructor for the contract
    constructor() {}

    // Function to retrieve a transfer record by its ID
    function getTransfer(string memory transferId) public view returns (TransferRecord memory) {
        return transfers[transferId];
    }
    
    // Internal function to create a record for a transfer
    function createTransferRecord(address recipient, uint256 amount, uint256 source_chain, address token_in, address token_out, uint256 nonce) internal {
        
        // Generate a unique ID for the transfer
        string memory transferId = string(abi.encodePacked(Strings.toString(source_chain), Strings.toString(nonce)));

        // Ensure no duplicate transfer record exists
        require(transfers[transferId].amount == 0, "TransferRecord already created");

        // Verify that the transfer is allowed
        require(isTransferAllowed(source_chain, token_in, token_out), "Transfer not allowed");

        // Create the transfer record
        transfers[transferId] = TransferRecord({
            recipient: recipient,
            amount: amount,
            token_out: token_out,
            source_chain: source_chain,
            locked: false,
            completed: false,
            timestamp: block.timestamp
        });
    }

    // Internal function to mark a transfer as completed
    function _completeTransfer(string memory transferId) internal {
        // Check if the transfer is recorded, not locked, and not completed
        require(transferCreated(transferId), "Transfer not found");
        require(!transferLocked(transferId), "Transfer is locked");
        require(!transferCompleted(transferId), "Transfer already completed");

        // Perform the token transfer
        TransferRecord storage _transfer = transfers[transferId];
        __transfer(_transfer.recipient, _transfer.amount, _transfer.token_out);

        // Mark the transfer as completed
        _transfer.completed = true;
    }

    // Internal function to lock a transfer
    function _lockTransfer(string memory transferId) internal {
        // Check if the transfer is recorded, not locked, and not completed
        require(transferCreated(transferId), "Transfer not found");
        require(!transferLocked(transferId), "Transfer is locked");
        require(!transferCompleted(transferId), "Transfer already completed");

        // Lock the transfer
        transfers[transferId].locked = true;
    }

    // Check if a transfer is locked
    function transferLocked(string memory transferId) internal view returns (bool) {
        return transfers[transferId].locked;
    }

    // Check if a transfer is completed
    function transferCompleted(string memory transferId) internal view returns (bool) {
        return transfers[transferId].completed;
    }

    // Check if a transfer record has been created
    function transferCreated(string memory transferId) internal view returns (bool) {
        return transfers[transferId].amount != 0;
    }

    // Modifier to ensure a transfer is safe to proceed
    modifier safeToTransfer(string memory transferId) {
        require(transferCreated(transferId), "Transfer not found");
        require(!transferCompleted(transferId), "Transfer already completed");
        require(!transferLocked(transferId), "Transfer is locked");
        require(transfers[transferId].timestamp + lock_window < block.timestamp, "Transfer is within lock window");
        _;
    }
}
