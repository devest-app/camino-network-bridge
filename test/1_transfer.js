const DvBridge = artifacts.require("DvBridge");
const Helper = require('./helpers/Helper');
const { ethers } = require("ethers");

contract('Testing Transfers', (accounts) => {


    it('Chain ID needs to match', async () => {
        const bridge_contract = await DvBridge.deployed();


        // Example data
        const to = accounts[5]; // Recipient address
        const amount = 100; // Amount
        const chainId = 124; // Chain ID
        const blockNumber = "321" // Block number
        const nonce = 123456; // Nonce
        

        // Get the message hash
        const messageHash = await bridge_contract.getMessageHash(to, amount, chainId, blockNumber, nonce);

        // Sign the message hash
        console.log("Message Hash:", messageHash);

        const signature1 = web3.eth.accounts.sign(messageHash, Helper.privateKey1);
        const signature2 = web3.eth.accounts.sign(messageHash, Helper.privateKey2);


        try {
            const transfer = await bridge_contract.completeTransfer(to, amount, chainId, blockNumber, nonce, [signature1.signature, signature2.signature], {from: accounts[0]});

            // transfer should not have TransferCompleted event
            assert.equal(transfer.logs.length, 1, "Transfer should not be completed");

        } catch (error) {
            assert(error.reason, "Invalid chain id");
            assert.equal(error.reason, "Invalid chain id", "Invalid error reason");
        }

    });


    it('Complete the transfer', async () => {
        const bridge_contract = await DvBridge.deployed();


        // Example data
        const to = accounts[5]; // Recipient address
        const amount = 100; // Amount
        const chainId = 123; // Chain ID
        const blockNumber = "321" // Block number
        const nonce = 123456; // Nonce
        

        // Get the message hash
        const messageHash = await bridge_contract.getMessageHash(to, amount, chainId, blockNumber, nonce);

        // Sign the message hash
        console.log("Message Hash:", messageHash);

        const signature1 = web3.eth.accounts.sign(messageHash, Helper.privateKey1);
        const signature2 = web3.eth.accounts.sign(messageHash, Helper.privateKey2);

        // TODO: check recipient balance before and after transfer 



        try {
            // Check if the signatures are valid
            const transfer = await bridge_contract.completeTransfer(to, amount, chainId, blockNumber, nonce, [signature1.signature, signature2.signature], {from: accounts[0]});

            // transfer needs to have a TransferCompleted event
            assert.equal(transfer.logs[0].event, "TransferCompleted", "Transfer should be completed");


        } catch (error) {
            console.log(error);
            throw new Error("Transfer failed");
        }

    });

    it('Can not transfer again', async () => {
        const bridge_contract = await DvBridge.deployed();


        // Example data
        const to = accounts[5]; // Recipient address
        const amount = 100; // Amount
        const chainId = 123; // Chain ID
        const blockNumber = "321" // Block number
        const nonce = 123456; // Nonce
        

        // Get the message hash
        const messageHash = await bridge_contract.getMessageHash(to, amount, chainId, blockNumber, nonce);

        // Sign the message hash
        console.log("Message Hash:", messageHash);

        const signature1 = web3.eth.accounts.sign(messageHash, Helper.privateKey1);
        const signature2 = web3.eth.accounts.sign(messageHash, Helper.privateKey2);


        try {
            // Check if the signatures are valid
            const transfer = await bridge_contract.completeTransfer(to, amount, chainId, blockNumber, nonce, [signature1.signature, signature2.signature], {from: accounts[0]});           

            // transfer should not have TransferCompleted event
            assert.equal(transfer.logs.length, 1, "Transfer should not be completed");

        } catch (error) {
            assert(error.reason, "Transfer already processed");
            assert.equal(error.reason, "Transfer already processed", "Invalid error reason");
        }

    });



    it('Signatures are not valid', async () => {
        const bridge_contract = await DvBridge.deployed();

        // Example data
        const to = accounts[5]; // Recipient address
        const amount = 100; // Amount
        const chainId = 123; // Chain ID
        const blockNumber = "1234" // Block number

        const nonce = 123456; // Nonce

        
        // Example data
        const invalid_to = accounts[6]; // Recipient address
        const invalid_amount = 1000; // Amount

        // Get the message hash
        const messageHash = await bridge_contract.getMessageHash(to, amount, chainId, blockNumber, nonce);
        const messageHash3 = await bridge_contract.getMessageHash(invalid_to, invalid_amount, chainId, blockNumber, nonce);

        // Sign the message hash
        console.log("Message Hash:", messageHash);

        const signature1 = web3.eth.accounts.sign(messageHash, Helper.privateKey1);
        const signature3 = web3.eth.accounts.sign(messageHash3, Helper.privateKey2);


        try {
            // check that the signatures are both valid
    
            // Check if the signatures are valid
            const transfer = await bridge_contract.completeTransfer(to, amount, chainId, blockNumber, nonce, [signature1.signature, signature3.signature], {from: accounts[6]});
            
            // transfer should not have TransferCompleted event
            assert.equal(transfer.logs.length, 1, "Transfer should not be completed");

        } catch (error) {
            assert(error.reason, "Invalid signatures");
            assert.equal(error.reason, "Invalid signatures", "Invalid error reason");
        }

    });

});
