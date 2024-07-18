const { ethers, waffle } = require("hardhat");
const assert = require('assert');
const { deployContract } = require("./setup");


describe('Votings And Setup', () => {

    let bridge_contract;
    let token_contract;
    let deployer;
    let validators;
    let bridge_user;

    // Before all tests, deploy the contracts and set initial states
    before(async () => {
        ({
            bridge_contract,
            token_contract,
            deployer,
            validators,
            bridge_user
        } = await deployContract());
    });

    it("Validators Management - Adding new validator should fail if not sent by a validator", async function () {
        try {
            // get message for signing
            const nonce = "1"
            const vote_type = 1; // 1 - add validator 2 - remove validator

            const message = await bridge_contract.getVoteValidatorMessage(vote_type, validators[1].address, nonce);
            const msgBuffer = Buffer(message.replace("0x", ""), "hex")
            // sign the message - validators[0] is the only validator
            const signature = await validators[0].signMessage(msgBuffer);

            // add new validator
            await bridge_contract.connect(validators[1]).voteValidator(vote_type, validators[1].address, nonce, [signature]);


        } catch (error) {
            assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Not a validator'", "Invalid error message");
        }
    });

    it("Validators Management - Should fail if signed by a non-validator", async function () {
        try {
            // get message for signing
            const nonce = "1"
            const vote_type = 1; // 1 - add validator 2 - remove validator

            const message = await bridge_contract.getVoteValidatorMessage(vote_type, validators[1].address, nonce);
            const msgBuffer = Buffer(message.replace("0x", ""), "hex")
            // sign the message - validators[0] is the only validator
            const signature = await validators[1].signMessage(msgBuffer);

            // add new validator
            await bridge_contract.connect(validators[0]).voteValidator(vote_type, validators[1].address, nonce, [signature]);

        } catch (error) {
            assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Invalid signatures'", "Invalid error message");
        }
    });

    it("Validators Management - Adding new validator should work", async function () {
        try {
            // get message for signing
            const nonce = "1"
            const vote_type = 1; // 1 - add validator 2 - remove validator

            const messageHash = await bridge_contract.getVoteValidatorMessage(vote_type, validators[1].address, nonce);
            const messageHashBuffer = Buffer(messageHash.replace("0x", ""), "hex")

            // check there is 1 validator
            const contract_validators_before = await bridge_contract.getValidators();
            assert.equal(contract_validators_before.length, 1, "Invalid number of validators");

            // sign the message - validators[0] is the only validator
            const signature = await validators[0].signMessage(messageHashBuffer);

            // add new validator
            const _msg = await bridge_contract.connect(validators[0]).voteValidator(vote_type, validators[1].address, nonce, [signature]);

            // check there are 2 validators
            const contract_validators = await bridge_contract.getValidators();
            assert.equal(contract_validators.length, 2, "Invalid number of validators");
        } catch (error) {
            assert.strictEqual(error.message, "", "There was an error adding a validator");
        }
    });

    it("Validators Management - Adding validators should not working with same nonce", async function () {
        try {
            // get message for signing
            const nonce = "1"
            const vote_type = 1; // 1 - add validator 2 - remove validator

            const messageHash = await bridge_contract.getVoteValidatorMessage(vote_type, validators[1].address, nonce);
            const messageHashBuffer = Buffer(messageHash.replace("0x", ""), "hex")

            // check there is 1 validator
            const contract_validators_before = await bridge_contract.getValidators();
            assert.equal(contract_validators_before.length, 2, "Invalid number of validators");

            // sign the message - validators[0] is the only validator
            const signature1 = await validators[0].signMessage(messageHashBuffer);
            const signature2 = await validators[1].signMessage(messageHashBuffer);

            // add new validator
            const _msg = await bridge_contract.connect(validators[0]).voteValidator(vote_type, validators[1].address, nonce, [signature1, signature2]);

        } catch (error) {
            assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Already voted'", "Invalid error message");
        }
    });


    it("Validators Management - Adding validators should not working with invalid vote type", async function () {
        try {
            // get message for signing
            const nonce = "2"
            const vote_type = 3; // 1 - add validator 2 - remove validator

            const messageHash = await bridge_contract.getVoteValidatorMessage(vote_type, validators[2].address, nonce);
            const messageHashBuffer = Buffer(messageHash.replace("0x", ""), "hex")

            // sign the message - validators[0] is the only validator
            const signature1 = await validators[0].signMessage(messageHashBuffer);
            const signature2 = await validators[1].signMessage(messageHashBuffer);

            // add new validator
            const _msg = await bridge_contract.connect(validators[0]).voteValidator(vote_type, validators[2].address, nonce, [signature1, signature2]);

        } catch (error) {
            assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Invalid vote'", "Invalid error message");
        }
    });

    it("Validators Management - Should not add validator if already in validators", async function () {
        try {
            // get message for signing
            const nonce = "2";
            const vote_type = 1; // 1 - add validator 2 - remove validator

            const messageHash = await bridge_contract.getVoteValidatorMessage(vote_type, validators[1].address, nonce);
            const messageHashBuffer = Buffer(messageHash.replace("0x", ""), "hex");

            // sign the message - validators[0] is the only validator
            const signature1 = await validators[0].signMessage(messageHashBuffer);
            const signature2 = await validators[1].signMessage(messageHashBuffer);

            // add new validator
            const _msg = await bridge_contract.connect(validators[0]).voteValidator(vote_type, validators[1].address, nonce, [signature1, signature2]);

        } catch (error) {
            assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Validator already exists'", "Invalid error message");
        }
    });

    it("Validators Management - Removing validator should work", async function () {
        try {
            // get message for signing
            const nonce = "3"
            const vote_type = 2; // 1 - add validator 2 - remove validator

            const messageHash = await bridge_contract.getVoteValidatorMessage(vote_type, validators[1].address, nonce);
            const messageHashBuffer = Buffer(messageHash.replace("0x", ""), "hex")

            // sign the message - validators[0] is the only validator
            const signature1 = await validators[0].signMessage(messageHashBuffer);
            const signature2 = await validators[1].signMessage(messageHashBuffer);

            // remove added validator
            const _msg = await bridge_contract.connect(validators[0]).voteValidator(vote_type, validators[1].address, nonce, [signature1, signature2]);

            // check there is 1 validator
            const contract_validators = await bridge_contract.getValidators();
            assert.equal(contract_validators.length, 1, "Invalid number of validators");
        } catch (error) {
            console.log(error)
        }
    });


    it("Validators Management - Should add 2 validators", async function () {
        try {
            // get message for signing
            const nonce = "4"
            const vote_type = 1; // 1 - add validator 2 - remove validator

            const messageHash = await bridge_contract.getVoteValidatorMessage(vote_type, validators[1].address, nonce);
            const messageHashBuffer = Buffer(messageHash.replace("0x", ""), "hex")

            // sign the message - validators[0] is the only validator
            const signature = await validators[0].signMessage(messageHashBuffer);

            // add new validator
            await bridge_contract.connect(validators[0]).voteValidator(vote_type, validators[1].address, nonce, [signature]);

            const nonce2 = "5"

            const messageHash2 = await bridge_contract.getVoteValidatorMessage(vote_type, validators[2].address, nonce2);
            const messageHashBuffer2 = Buffer(messageHash2.replace("0x", ""), "hex")

            const signature1 = await validators[0].signMessage(messageHashBuffer2);
            const signature2 = await validators[1].signMessage(messageHashBuffer2);

            // add new validator
            await bridge_contract.connect(validators[1]).voteValidator(vote_type, validators[2].address, nonce2, [signature1, signature2]);

            const contract_validators_polygon = await bridge_contract.getValidators();
            assert.equal(contract_validators_polygon.length, 3, "Invalid number of validators");

        } catch (error) {
            assert.strictEqual(error.message, "", "There was an error adding a validator");
        }

    });

    // Can't remove validator with older signatures
    it("Validators Management - Should not remove validator with older signatures and nonce", async function () {
        try {
            // get message for signing
            const nonce = "3"
            const vote_type = 2; // 1 - add validator 2 - remove validator

            const messageHash = await bridge_contract.getVoteValidatorMessage(vote_type, validators[1].address, nonce);
            const messageHashBuffer = Buffer(messageHash.replace("0x", ""), "hex")

            // sign the message - validators[0] is the only validator
            const signature1 = await validators[0].signMessage(messageHashBuffer); // 0xaa7e30b25ba4b62a47a09a0ac7c5ddfaa76519199ccf568c13775e6f8778d9d5474cdbf372d01c9f6293c64cb43c04461cd26d7332b4e2caf6df25ab614c158a1c
            const signature2 = await validators[1].signMessage(messageHashBuffer); // 0x3a4ffd971810b374046256666b6afe699621a2954ca80609a25694ea5251c63151707c097636c9489d94fd595018a353b3bf7f7be7bccff9bf788808c6a159821b

            // remove validator
            const _msg = await bridge_contract.connect(validators[0]).voteValidator(vote_type, validators[1].address, nonce, [signature1, signature2]);

        } catch (error) {
            assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Already voted'", "Invalid error message");
        }
    });

    it("Validators Rewards Voting - Should set validator reward fee", async function () {
        try {
            const nonce = "1";
            const value = 100;

            // check there is a reward fee
            const contract_reward_fee_before = await bridge_contract.validator_fee();
            assert.equal(contract_reward_fee_before.toNumber(), 80, "Invalid reward fee");

            // get message for signing
            const message = await bridge_contract.getVoteRewardMessage(value, nonce);
            const messageHashBuffer = Buffer(message.replace("0x", ""), "hex")

            // sign the message - with all validators
            const signature1 = await validators[0].signMessage(messageHashBuffer);
            const signature2 = await validators[1].signMessage(messageHashBuffer);
            const signature3 = await validators[2].signMessage(messageHashBuffer);

            // set reward fee
            const _msg = await bridge_contract.connect(validators[0]).setValidatorReward(value, nonce, [signature1, signature2, signature3]);

            // check there is reward fee
            const contract_reward_fee = await bridge_contract.validator_fee();
            assert.equal(contract_reward_fee.toNumber(), value, "Invalid reward fee");
        } catch (error) {
            assert.strictEqual(error.message, "", "There was an error setting the reward fee");
        }
    });

    it("Validators Rewards Voting - Should not set validator reward fee if not sent by a validator", async function () {
        try {
            const nonce = "1";
            const value = 100;

            // get message for signing
            const message = await bridge_contract.getVoteRewardMessage(value, nonce);
            const messageHashBuffer = Buffer(message.replace("0x", ""), "hex")

            // sign the message - with all validators
            const signature1 = await validators[0].signMessage(messageHashBuffer);
            const signature2 = await validators[1].signMessage(messageHashBuffer);
            const signature3 = await validators[2].signMessage(messageHashBuffer);

            // set reward fee
            const _msg = await bridge_contract.connect(bridge_user).setValidatorReward(value, nonce, [signature1, signature2, signature3]);
        } catch (error) {
            assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Not a validator'", "Invalid error message");
        }
    });

    it("Validators Rewards Voting - Should not be able to set the fee again with same signatures and nonce", async function () {
        try {
            const nonce = "1";
            const value = 100;

            // get message for signing
            const message = await bridge_contract.getVoteRewardMessage(value, nonce);
            const messageHashBuffer = Buffer(message.replace("0x", ""), "hex")

            // sign the message - with all validators
            const signature1 = await validators[0].signMessage(messageHashBuffer);
            const signature2 = await validators[1].signMessage(messageHashBuffer);
            const signature3 = await validators[2].signMessage(messageHashBuffer);

            // set reward fee
            const _msg = await bridge_contract.connect(validators[0]).setValidatorReward(value, nonce, [signature1, signature2, signature3]);
        } catch (error) {
            assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Vote already cast'", "Invalid error message");
        }
    });

    // Set higer fee
    it("Validators Rewards Voting - Should not set validator reward fee if not enough signatures", async function () {
        try {
            const nonce = "2";
            const value = 150;

            // get message for signing
            const message = await bridge_contract.getVoteRewardMessage(value, nonce);
            const messageHashBuffer = Buffer(message.replace("0x", ""), "hex")

            // sign the message - with all validators
            const signature1 = await validators[0].signMessage(messageHashBuffer);
            const signature2 = await validators[1].signMessage(messageHashBuffer);

            // set reward fee
            const _msg = await bridge_contract.connect(validators[0]).setValidatorReward(value, nonce, [signature1, signature2]);

            // check there is reward fee
            const contract_reward_fee = await bridge_contract.validator_fee();
            assert.equal(contract_reward_fee.toNumber(), value, "Invalid reward fee");
        } catch (error) {
            assert.strictEqual(error.message, "", "There was an error setting the reward fee");
        }
    });

    it("Token Management - Should not set allowed transfer if not sent by a validator", async function () {
        try {
            const destination_chain = 321;
            const source_chain = 123;
            const token_in = "0x0000000000000000000000000000000000000000";
            const token_out = token_contract.address;
            const active = true;
            const max_amount = 100;
            const nonce = "1";

            // get message for signing
            const message = await bridge_contract.getAllowedTransferMessage(source_chain, destination_chain, token_in, token_out, active, max_amount, nonce);
            const messageHashBuffer = Buffer(message.replace("0x", ""), "hex")

            // sign the message - with all validators
            const signature1 = await validators[0].signMessage(messageHashBuffer);
            const signature2 = await validators[1].signMessage(messageHashBuffer);
            const signature3 = await validators[2].signMessage(messageHashBuffer);


            await bridge_contract.connect(bridge_user).setAllowedTransfer(source_chain, destination_chain, token_in, token_out, active, max_amount, nonce, [signature1, signature2, signature3]);
        } catch (error) {
            assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Not a validator'", "Invalid error message");
        }
    });

    it("Token Management - Should allow token transfer", async function () {
        try {
            let destination_chain = 123;
            let source_chain = 321;
            let token_in = "0x0000000000000000000000000000000000000000";
            let token_out = token_contract.address;
            const active = true;
            const max_amount = 100;
            let nonce = "1";

            // get message for signing
            const message = await bridge_contract.getAllowedTransferMessage(source_chain, destination_chain, token_in, token_out, active, max_amount, nonce);
            const messageHashBuffer = Buffer(message.replace("0x", ""), "hex")

            // sign the message - with all validators
            const signature1 = await validators[0].signMessage(messageHashBuffer);
            const signature2 = await validators[1].signMessage(messageHashBuffer);
            const signature3 = await validators[2].signMessage(messageHashBuffer);

            const _msg = await bridge_contract.connect(validators[0]).setAllowedTransfer(source_chain, destination_chain, token_in, token_out, active, max_amount, nonce, [signature1, signature2, signature3]);

            const allowed_transfer = await bridge_contract.getAllowedTransfer(source_chain, destination_chain, token_in);
            assert.equal(allowed_transfer.active, active, "Invalid active status");
            assert.equal(allowed_transfer.max_amount, max_amount, "Invalid max amount");
            assert.equal(allowed_transfer.token_out, token_out, "Invalid token out");

            // setup reverse transfer
            destination_chain = 321;
            source_chain = 123;
            token_in = token_contract.address;
            token_out = "0x0000000000000000000000000000000000000000";
            nonce = "2";

            const messageReverse = await bridge_contract.getAllowedTransferMessage(source_chain, destination_chain, token_in, token_out, active, max_amount, nonce);
            const messageHashBufferReverse = Buffer(messageReverse.replace("0x", ""), "hex")

            // sign the message - with all validators
            const signature1Reverse = await validators[0].signMessage(messageHashBufferReverse);
            const signature2Reverse = await validators[1].signMessage(messageHashBufferReverse);
            const signature3Reverse = await validators[2].signMessage(messageHashBufferReverse);

            const _msgReverse = await bridge_contract.connect(validators[0]).setAllowedTransfer(source_chain, destination_chain, token_in, token_out, active, max_amount, nonce, [signature1Reverse, signature2Reverse, signature3Reverse]);

            const allowed_transferReverse = await bridge_contract.getAllowedTransfer(source_chain, destination_chain, token_in);
            assert.equal(allowed_transferReverse.active, active, "Invalid active status");
            assert.equal(allowed_transferReverse.max_amount, max_amount, "Invalid max amount");
            assert.equal(allowed_transferReverse.token_out, token_out, "Invalid token out");


            // setup for destination contract
            token_in = token_contract.address;
            token_out = "0x0000000000000000000000000000000000000000";
        } catch (error) {
            assert.strictEqual(error.message, "", "There was an error setting the allowed transfer");
        }
    });

    it("Token Management - Should not allow token transfer with same nonce", async function () {
        try {
            const destination_chain = 321;
            const source_chain = 321;
            const token_in = "0x0000000000000000000000000000000000000000";
            const token_out = token_contract.address;
            const active = true;
            const max_amount = 100;
            const nonce = "1";

            // get message for signing
            const message = await bridge_contract.getAllowedTransferMessage(source_chain, destination_chain, token_in, token_out, active, max_amount, nonce);
            const messageHashBuffer = Buffer(message.replace("0x", ""), "hex")

            // sign the message - with all validators
            const signature1 = await validators[0].signMessage(messageHashBuffer);
            const signature2 = await validators[1].signMessage(messageHashBuffer);
            const signature3 = await validators[2].signMessage(messageHashBuffer);

            const _msg = await bridge_contract.connect(validators[0]).setAllowedTransfer(source_chain, destination_chain, token_in, token_out, active, max_amount, nonce, [signature1, signature2, signature3]);

        } catch (error) {
            assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Transfer vote already cast'", "Invalid error message");
        }
    });

});
