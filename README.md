# Devest Bridge Documentation
## Overview
The Devest Bridge is a cross-chain token transfer protocol inspired by the Layer Zero approach. It leverages a multi-signature (multisig) mechanism where validator nodes collect and submit signatures to validate transactions. Unlike traditional methods, individual validator nodes do not submit separate transactions. Instead, one node gathers signatures from all validators and submits a single transaction to the smart contract. If at least half of the signatures are valid, the transaction is executed on the destination chain.


![Alt text](docs/flow.png)


## Bridging workflow
This documentation outlines the process of initiating and completing a cross-chain token transfer between two blockchain networks using smart contracts and validators.

### Process Flow

#### 1. Transfer Initialization on Source Chain

1. **User Request:**
   - The process begins when a user initiates a transfer request on the source blockchain network.
   - The user specifies the amount of tokens to be transferred.

2. **Token Locking:**
   - The specified amount of tokens is locked in a smart contract on the source chain.
   - An event is fired by the smart contract to indicate the tokens have been locked.

#### 2. Event Detection by Validators

1. **Listening for Events:**
   - Validators are configured to monitor smart contracts on both the source and destination blockchain networks.
   - When a validator detects a token lock event on the source chain, it initiates the next step.

#### 3. Signature Collection

1. **Initiation by Validator:**
   - Upon detecting the TransferInitiated event, a validator begins the process of collecting signatures from other validators.
   - Validators validate the event and prepare their signatures.

2. **Consensus Mechanism:**
   - Validators use a consensus mechanism to approve the transfer.
   - A signature is collected from each validator.

#### 4. Completing the Transfer on Destination Chain

1. **Random Validator Selection:**
   - Once all necessary signatures are collected, a validator is randomly chosen to complete the transfer.

2. **Calling Transfer Function:**
   - The chosen validator calls the complete transfer function on the destination chain’s smart contract.

3. **Signature Verification:**
   - The smart contract checks if at least half of the signatures are correct and approved.

4. **Token Transfer:**
   - If the signature verification is successful, the equivalent amount of tokens locked on the source chain is transferred to the user from the smart contract on the destination chain.

**NOTE**:
Bridging tokens works only for predefined pairs, meaning the tokens need to be transferred and locked when setting up the bridge contracts. For example, Camino tokens on the Camino network can be transferred only to wrapped Camino tokens on the Polygon network. The smart contract on the destination chain needs to have a balance of wrapped Camino tokens that can be transferred to the user who initiates the bridging process.

The pairs can be set up by any validator address. This useful feature for strict pair bridging allows for tracking what tokens can be bridged and setting the maximum allowed amount a person can transfer. Setting a maximum allowed amount of tokens that can be bridged with a single transaction is a safety mechanism that prevents attackers from pulling the whole balance of the bridge.



### Smart Contract Events and Functions


#### Source Chain Smart Contract

- **Events:**
  - `TransferInitiated(address sender, address recipient, uint256 amount, uint256 source_chain, uint256 destination_chain, address token_in, address token_out)`: Fired when tokens are locked by the user

- **Functions:**
  - `initiateTransfer(address recipient, uint256 amount, uint256 source_chain, uint256 destination_chain, address token_in, address token_out)`: Locks the specified amount of tokens and fires the `TokensLocked` event.

#### Destination Chain Smart Contract

- **Events:**
- `TransferCompleted(address recipient, uint256 amount, uint256 source_chain, uint256 destination_chain, address token_in, address token_out, string nonce, bytes[] signatures, address msg_sender)`: Fired when tokens are transfered to the user on the destination chain.

- **Functions:**
  - `completeTransfer(address recipient, uint256 amount, uint256 source_chain, uint256 destination_chain, address token_in, address token_out, string memory nonce, bytes[] memory signatures)`: Verifies the signatures and transfers tokens to the user if the signatures are valid.


## Smart Contracts Overview

### DvBridge
The primary contract that manages cross-chain transfers, validator operations, and integrates functionalities from TokenController, TransferManager, and ValidatorSignatureManager.

* lock_time: The timestamp until which the contract is locked for transfers to addresses other than validators.
* chain_id: The ID of the chain where the contract is deployed.
* validator_fee: The fee to be paid to validators for each transaction.
Key Functions 
* constructor: Initializes the contract with chain ID, validator fee, and validators.
* initiateTransfer: Initiates a transfer by locking tokens in the contract.
* completeTransfer: Completes a transfer by sending tokens to the recipient.
* lock: Locks the bridge for transfers to non-validators for a specified time.
* voteValidator: Handles validator voting for adding or removing validators.
* setAllowedTransfer: Sets allowed transfer parameters for a specific destination chain and token.
* setValidatorReward: Sets the validator reward fee.

### ValidatorSignatureManager
Handles signature verification with a set of validators.

* getTransactionMessage: Generates a message of transaction details for signature.
* getVoteValidatorMessage: Generates a message for validator vote for signature.
* getVoteRewardMessage: Generates a message for reward vote for signature.
* verifySignatures: Verifies if the provided signatures are valid and from validators.
* rewardValidators: Distributes the validator fee among validators.
* addValidator: Adds a new validator.
* removeValidator: Removes an existing validator.
* getValidators: Returns the list of validators.
* isValidator: Checks if an address is a validator.

### TransferManager
Extends TokenController to manage allowed transfers between token pairs on different chains.

* __setAllowedTransfer: Sets allowed transfer details for a destination chain and token pair.
* getTransfer: Checks if a transfer record exists.
* getAllowedTransfer: Retrieves allowed transfer details.
* _completeTransfer: Completes a transfer and records it.
* transferCompleted: Checks if a transfer has been completed.
* isTransferAllowed: Verifies if a transfer is allowed based on set parameters.

### TokenController
A contract managing token transfers and balances for both native cryptocurrency and ERC20 tokens.

* __transfer: Transfers tokens or native cryptocurrency.
* __balanceOf: Retrieves the balance of a specified account for a given token.
* __allowance: Checks if the allowance for a token is sufficient for a transfer.




## Private Network

### Signaling Service

The signaling service is a WebSocket-based system responsible for managing the initial connection and validation of nodes attempting to join a private peer network. It ensures secure communication through data encryption and verifies the legitimacy of nodes using a signature validation mechanism.

#### Key Features
- **WebSocket Implementation:** Utilizes WebSocket Secure (wss) for data encryption and secure communication.
- **Node Connection Validation:** Checks if a node can connect to the network by validating its signature.
- **Signature Validation:** 
  - When a node requests to connect, its signature is validated against a list of validators stored on the smart contract.
  - If the signature for the public address matches the signature from the list, the signaling server communicates to other validator nodes about the new node's connection request.
  - The node connection data is passed through the signaling server to all nodes to establish a private peer network.
  - If the signature is invalid, the node is denied connection and is automaticaly terminated by the the signaling service.

#### Workflow
1. **Node Connection Request:**
   - A node requests to connect to the network.
   - The signaling server receives the request and the node's signature.
2. **Signature Validation:**
   - The server checks the node's signature against the list of validators on the smart contract.
3. **Connection Approval:**
   - If the signature is valid, the signaling server notifies other validator nodes about the new connection.
   - The node connection data is disseminated to all nodes, establishing a private peer network.
4. **Connection Denial:**
   - If the signature is invalid, the node is denied access and cannot communicate further with the signaling service.

#### Security Considerations
- **Data Encryption:** Ensures all communication is encrypted using WebSocket Secure (wss).
- **Signature Validation:** Validates node signatures against the list of validators stored on the smart contract.



### Validator Nodes

Validator nodes play a critical role in bridging networks, validating transactions, and maintaining network integrity. They listen to smart contract events and interact with other nodes via a private network to manage and validate transactions.

#### Key Features
- **Network Bridging:** Responsible for bridging to other networks and rewarded for validation efforts.
- **Preconfiguration:** Nodes need to be preconfigured before joining the network.
- **Signaling Service Connection:** On startup, nodes contact the signaling service to connect to the private network.
- **Peer Communication:** Use the `simple-peer` library (JavaScript version) to establish connections with other nodes.
- **Event Listening:** 
  - Nodes listen to chain events every 10 seconds.
  - They check for `TransferInitiated` and `TransferCompleted` events.
- **Transaction Management:** 
  - On finding a new transfer initiated event, the main node collects signatures from all other validators and submits the transaction once all signatures are collected.
- **Unauthorized Transfer Detection:** 
  - Nodes can detect unauthorized transfers and lock the bridge contracts if necessary.
  - Locking the bridge allows for additional time to investigate the issue.
  - Once the bridge is locked, funds in the contract can only be transferred only to a validator address.
- **Notifications and Voting:**
  - Utilizes Telegraph to notify if contracts are locked.
  - Facilitates voting for adding/removing validators and setting validator rewards.
- **Security:** Each node has its own private key, which must be protected.

#### Workflow
1. **Startup:**
   - Node contacts the signaling service to connect to the private network.
2. **Peer Network Connection:**
   - Establishes connections with other nodes using the `simple-peer` library.
3. **Event Listening:**
   - Listens to chain events every 10 seconds.
4. **Transaction Initiation:**
   - If an `TransferInitiated` event is detected, the main node contacts other validators to collect signatures.
   - Once all signatures are collected, the transaction is submitted.
5. **Unauthorized Transfer Handling:**
   - If an unauthorized transfer is detected, nodes can lock the bridge contracts.
6. **Notifications and Voting:**
   - Uses Telegraph for notifications and supports voting for network governance.

#### Security Considerations
- **Private Key Protection:** Emphasizes the importance of protecting each node's private key to maintain network security.
- **Chain Event Monitoring:** Regularly listens to chain events to detect and handle unauthorized transfers.
