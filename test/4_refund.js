const assert = require('assert');
const { deployAndSetupContracts } = require("./setup");
const { validator } = require('web3');

describe('Recover Funds - Block Transfers', () => {

    let bridge_contract;
    let token_contract;
    let deployer;
    let validators;
    let bridge_user;
    let provider;

    let zero_address = "0x0000000000000000000000000000000000000000";

    // Before all tests, deploy the contracts and set initial states
    before(async () => {
        ({
            bridge_contract,
            token_contract,
            deployer,
            validators,
            bridge_user,
            provider
        } = await deployAndSetupContracts());
    });
    
    it("Recover Funds [FAIL] - sender is not a validator", async function () {
        try {
            const recipient = bridge_user.address;
            const amount = 100;
            const token_in = token_contract.address;
            const source_chain = "123"; // contract chain id
            const destination_chain = "321";
            const nonce = "123456789";

            await bridge_contract.connect(bridge_user).recoverFunds(recipient, amount, source_chain, destination_chain, token_in, nonce, []);
        } catch (error) {
            assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Not a validator'", "Invalid error message");
        }
    });

    it("Recover Funds [FAIL] - invalid source chain", async function () {
        try {
            const recipient = bridge_user.address;
            const amount = 100;
            const token_in = token_contract.address;
            const source_chain = "321"; 
            const destination_chain = "123"; // contract chain id
            const nonce = "123456789";

            const message = await bridge_contract.getRecoverFundsMessage(recipient, amount, source_chain, destination_chain, token_in, nonce);
            const messageHashBuffer = Buffer(message.replace("0x", ""), "hex")

            // sign the message - with all validators
            const signature1 = await validators[0].signMessage(messageHashBuffer);
            const signature2 = await validators[1].signMessage(messageHashBuffer);
            const signature3 = await validators[2].signMessage(messageHashBuffer);

            await bridge_contract.connect(validators[2]).recoverFunds(recipient, amount, source_chain, destination_chain, token_in, nonce, [signature1, signature2, signature3]);
        } catch (error) {
            assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Invalid source chain'", "Invalid error message");
        }
    });

    it("Recover Funds [FAIL] - invalid signatures", async function () {
        try {
            const recipient = bridge_user.address;
            const amount = 100;
            const token_in = token_contract.address;
            const source_chain = "123"; // contract chain id
            const destination_chain = "321";
            const nonce = "123456789";

            const message = await bridge_contract.getRecoverFundsMessage(recipient, amount, source_chain, destination_chain, token_in, nonce);
            const messageHashBuffer = Buffer(message.replace("0x", ""), "hex")

            // sign the message - with all validators
            const signature1 = await validators[0].signMessage(messageHashBuffer);
            const signature2 = await bridge_user.signMessage(messageHashBuffer);

            await bridge_contract.connect(validators[2]).recoverFunds(recipient, amount, source_chain, destination_chain, token_in, nonce, [signature1, signature2]);
        } catch (error) {
            assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Invalid signatures'", "Invalid error message");
        }
    });

    it("Recover Funds [SUCCESS] - recover funds", async function () {
        const recipient = bridge_user.address;
        const amount = 100;
        const token_in = token_contract.address;
        const source_chain = "123"; // contract chain id
        const destination_chain = "321";
        const nonce = "123456789";

        // check contract balance before
        const contract_before = await token_contract.balanceOf(bridge_contract.address);

        // check recipient balance before
        const recipient_before = await token_contract.balanceOf(recipient);

        const message = await bridge_contract.getRecoverFundsMessage(recipient, amount, source_chain, destination_chain, token_in, nonce);
        const messageHashBuffer = Buffer(message.replace("0x", ""), "hex")

        // sign the message - with all validators
        const signature1 = await validators[0].signMessage(messageHashBuffer);
        const signature2 = await validators[1].signMessage(messageHashBuffer);
        const signature3 = await validators[2].signMessage(messageHashBuffer);

        const transaction = await bridge_contract.connect(validators[2]).recoverFunds(recipient, amount, source_chain, destination_chain, token_in, nonce, [signature1, signature2, signature3]);
        assert.notEqual(transaction, undefined || null, "Invalid error message");

        // check contract balance after
        const contract_after = await token_contract.balanceOf(bridge_contract.address);
        assert.strictEqual(contract_after.toString(), contract_before.sub(amount).toString(), "Invalid contract balance");

        // check recipient balance after
        const recipient_after = await token_contract.balanceOf(recipient);
        assert.strictEqual(recipient_after.toString(), recipient_before.add(amount).toString(), "Invalid recipient balance");

    });

    it("Recover Funds [FAIL] - cannot recover funds twice with same signatures", async function () {
        try {
            const recipient = bridge_user.address;
            const amount = 100;
            const token_in = token_contract.address;
            const source_chain = "123"; // contract chain id
            const destination_chain = "321";
            const nonce = "123456789";

            const message = await bridge_contract.getRecoverFundsMessage(recipient, amount, source_chain, destination_chain, token_in, nonce);
            const messageHashBuffer = Buffer(message.replace("0x", ""), "hex")

            // sign the message - with all validators
            const signature1 = await validators[0].signMessage(messageHashBuffer);
            const signature2 = await validators[1].signMessage(messageHashBuffer);
            const signature3 = await validators[2].signMessage(messageHashBuffer);

            await bridge_contract.connect(validators[2]).recoverFunds(recipient, amount, source_chain, destination_chain, token_in, nonce, [signature1, signature2, signature3]);
        }
        catch (error) {
            assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Transfer already completed'", "Invalid error message");
        }
    });

    it("Block Transfer [FAIL] - sender is not a validator", async function () {
        try {
            const source_chain = "321"; 
            const destination_chain = "123"; // contract chain id
            const nonce = "123456789";

            await bridge_contract.connect(bridge_user).blockTransfer(source_chain, destination_chain, nonce, []);
        } catch (error) {
            assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Not a validator'", "Invalid error message");
        }
    });

    it("Block Transfer [FAIL] - invalid destination chain", async function () {
        try {
            const source_chain = "321"; 
            const destination_chain = "1234"; // contract chain id
            const nonce = "123456789";

            await bridge_contract.connect(validators[2]).blockTransfer(source_chain, destination_chain, nonce, []);
        } catch (error) {
            assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Invalid destination chain'", "Invalid error message");
        }
    });

    it("Block Transfer [FAIL] - invalid signatures", async function () {
        try {
            const source_chain = "321"; 
            const destination_chain = "123"; // contract chain id
            const nonce = "123456789";

            const message = await bridge_contract.getBlockTransferMessage(source_chain, destination_chain, nonce);
            const messageHashBuffer = Buffer(message.replace("0x", ""), "hex")

            // sign the message - with all validators
            const signature1 = await validators[0].signMessage(messageHashBuffer);
            const signature2 = bridge_user.signMessage(messageHashBuffer);

            await bridge_contract.connect(validators[2]).blockTransfer(source_chain, destination_chain, nonce, [signature1, signature2]);
        } catch (error) {
            assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Invalid signatures'", "Invalid error message");
        }
    });

    it("Block Transfer [SUCCESS] - block transfer", async function () {
        const source_chain = "321"; 
        const destination_chain = "123"; // contract chain id
        const nonce = "123456789";

        const message = await bridge_contract.getBlockTransferMessage(source_chain, destination_chain, nonce);
        const messageHashBuffer = Buffer(message.replace("0x", ""), "hex")

        // sign the message - with all validators
        const signature1 = await validators[0].signMessage(messageHashBuffer);
        const signature2 = await validators[1].signMessage(messageHashBuffer);
        const signature3 = await validators[2].signMessage(messageHashBuffer);

        const transaction = await bridge_contract.connect(validators[2]).blockTransfer(source_chain, destination_chain, nonce, [signature1, signature2, signature3]);

        assert.notEqual(transaction, undefined || null, "Invalid error message");
    });

    it("Block Transfer [FAIL] - cannot block transfer twice with same signatures", async function () {
        try {
            const source_chain = "321"; 
            const destination_chain = "123"; // contract chain id
            const nonce = "123456789";

            const message = await bridge_contract.getBlockTransferMessage(source_chain, destination_chain, nonce);
            const messageHashBuffer = Buffer(message.replace("0x", ""), "hex")

            // sign the message - with all validators
            const signature1 = await validators[0].signMessage(messageHashBuffer);
            const signature2 = await validators[1].signMessage(messageHashBuffer);
            const signature3 = await validators[2].signMessage(messageHashBuffer);

            await bridge_contract.connect(validators[2]).blockTransfer(source_chain, destination_chain, nonce, [signature1, signature2, signature3]);
        }
        catch (error) {
            assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Transfer already blocked'", "Invalid error message");
        }
    });

    it("Block Transfer [FAIL] - cannot complete transfer after blocking", async function () {
        const recipient = bridge_user.address;
        const amount = 100;
        const token_in = token_contract.address;
        const token_out = zero_address;
        const source_chain = "321"; 
        const destination_chain = "123"; // contract chain id
        const nonce = "123456789";


        try {
            const message = await bridge_contract.getTransactionMessage(recipient, amount, source_chain, destination_chain, token_in, token_out, nonce);
            const messageHashBuffer = Buffer(message.replace("0x", ""), "hex")

            // sign the message - with all validators
            const signature1 = await validators[0].signMessage(messageHashBuffer);
            const signature2 = await validators[1].signMessage(messageHashBuffer);

            await bridge_contract.connect(validators[2]).completeTransfer(recipient, amount, source_chain, destination_chain, token_in, token_out, nonce, [signature1, signature2]);
        } catch (error) {
            assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Transfer already completed'", "Invalid error message");
        }
    });

});