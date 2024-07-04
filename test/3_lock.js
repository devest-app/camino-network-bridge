const assert = require('assert');
const { deployAndSetupContracts } = require("./setup");
const { validator } = require('web3');

describe('Bridge Lock', () => {

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
    it("Locking [FAIL] - sender is not a validator", async function () {
        try {
            const nonce = "123456789";
            await bridge_contract.connect(bridge_user).lock(nonce, []);
        } catch (error) {
            assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Not a validator'", "Invalid error message");
        }
    });

    it("Locking [SUCCESS] - lock the bridge", async function () {
        const nonce = "123456789";

        const message = await bridge_contract.getLockMessage(nonce);
        const messageHashBuffer = Buffer(message.replace("0x", ""), "hex")

        // sign the message - with all validators
        const signature1 = await validators[0].signMessage(messageHashBuffer);
        const signature2 = await validators[1].signMessage(messageHashBuffer);
        const signature3 = await validators[2].signMessage(messageHashBuffer);

        const transaction = await bridge_contract.connect(validators[2]).lock(nonce, [signature1, signature2, signature3]);
        assert.notEqual(transaction, undefined || null, "Invalid error message");
    });

    it("Locking [FAIL] - can't initiate transfer", async function () {
        const recipient = bridge_user.address;
        const amount = 100;
        const token_in = token_contract.address;
        const token_out = zero_address;

        try {
            const source_chain = "123"; // contract chain id
            const destination_chain = "321"; 

            await bridge_contract.connect(bridge_user).initiateTransfer(recipient, amount, source_chain, destination_chain, token_in, token_out);
        } catch (error) {
            assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Bridge is locked'", "Invalid error message");
        }
    });

    it("Locking [FAIL] - cannot lock the bridge twice with same signatures", async function () {
        const nonce = "123456789";

        const message = await bridge_contract.getLockMessage(nonce);
        const messageHashBuffer = Buffer(message.replace("0x", ""), "hex")

        // sign the message - with all validators
        const signature1 = await validators[0].signMessage(messageHashBuffer);
        const signature2 = await validators[1].signMessage(messageHashBuffer);
        const signature3 = await validators[2].signMessage(messageHashBuffer);

        try {
            await bridge_contract.connect(validators[2]).lock(nonce, [signature1, signature2, signature3]);
        }
        catch (error) {
            assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Vote already cast'", "Invalid error message");
        }
    });

    it("BridgeLocked - Can transfer only to validator", async function () {

        let recipient = validators[1].address;
        const amount = 100;
        const source_chain = "321";
        const destination_chain = "123"; // contract chain id
        const token_in = token_contract.address;
        const token_out = "0x0000000000000000000000000000000000000000";
        const nonce = "123456718";

        const message = await bridge_contract.getTransactionMessage(recipient, amount, source_chain, destination_chain, token_in, token_out, nonce);
        const messageHashBuffer = Buffer(message.replace("0x", ""), "hex")

        // sign the message - with all validators
        const signature1 = await validators[0].signMessage(messageHashBuffer);
        const signature2 = await validators[1].signMessage(messageHashBuffer);
        const signature3 = await validators[2].signMessage(messageHashBuffer);

        const contract_balance_before = await provider.getBalance(bridge_contract.address);

        try {
            await bridge_contract.connect(validators[2]).completeTransfer(deployer.address, amount, source_chain, destination_chain, token_in, token_out, nonce, [signature1, signature2, signature3]);
        } catch (error) {
            assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Recipient is not a validator'", "Invalid error message");
        }

        try {
            await bridge_contract.connect(validators[2]).completeTransfer(recipient, amount, source_chain, destination_chain, token_in, token_out, nonce, [signature1, signature2, signature3]);
        } catch (error) {
            assert.strictEqual(error.message, "", "Invalid error message");
        }
        const contract_balance_after = await provider.getBalance(bridge_contract.address);
        assert.equal(contract_balance_after.toString(), contract_balance_before.sub(amount).toString(), "Invalid balance");
    });

});