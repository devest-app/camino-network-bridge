const assert = require('assert');
const { deployAndSetupContracts } = require("./setup");

describe('Destination Gateway - Complete Transfer', () => {

    let bridge_contract;
    let token_contract;
    let deployer;
    let validators;
    let bridge_user;
    let provider;

    let zero_address =  "0x0000000000000000000000000000000000000000";
    let source_chain = "321";
    let destination_chain = "123"; // contract chain id

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

    it("CompleteTransfer [FAIL] - sender is not a validator", async function () {
        try {
            await bridge_contract.connect(bridge_user).completeTransfer(zero_address, 100, source_chain, destination_chain, zero_address, zero_address, "12345678", []);
        } catch (error) {
            assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Not a validator'", "Invalid error message");
        }
    });

    it("CompleteTransfer [FAIL] - recipient is zero address", async function () {
        try {
            await bridge_contract.connect(validators[2]).completeTransfer(zero_address, 100, source_chain, destination_chain, zero_address, zero_address, "12345678", []);
        } catch (error) {
            assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Recipient cannot be zero address'", "Invalid error message");
        }
    });

    it("CompleteTransfer [FAIL] - amount is zero", async function () {
        try {
            await bridge_contract.connect(validators[2]).completeTransfer(bridge_user.address, 0, source_chain, destination_chain, zero_address, zero_address, "12345678", []);
        } catch (error) {
            assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Amount cannot be zero'", "Invalid error message");
        }
    });

    it("CompleteTransfer [FAIL] - destination chain is incorrect", async function () {
        try {
            await bridge_contract.connect(validators[2]).completeTransfer(bridge_user.address, 100, source_chain, "3213", zero_address, zero_address, "12345678", []);
        } catch (error) {
            assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Invalid destination chain'", "Invalid error message");
        }
    });

    it("CompleteTransfer [FAIL] - transfer not allowed", async function () {
        try {
            const recipient = bridge_user.address;
            const amount = 10;
            const token_in = token_contract.address;
            const token_out = "0x0000000000000000000000000000000000000001";
            const nonce = "12345678";

            const message = await bridge_contract.getTransactionMessage(recipient, amount, source_chain, destination_chain, token_in, token_out, nonce);
            const messageHashBuffer = Buffer(message.replace("0x", ""), "hex")

            // sign the message - with all validators
            const signature1 = await validators[0].signMessage(messageHashBuffer);
            const signature2 = await validators[1].signMessage(messageHashBuffer);
            const signature3 = await validators[2].signMessage(messageHashBuffer);

            await bridge_contract.connect(validators[2]).completeTransfer(recipient, amount, source_chain, destination_chain, token_in, token_out, nonce, [signature1, signature2, signature3]);

        } catch (error) {
            assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Transfer not allowed or amount exceeds maximum allowed'", "Invalid error message");
        }
    });

    it("CompleteTransfer [FAIL] - execed maximum amount", async function () {
        try {
            const recipient = bridge_user.address;
            const amount = 101;
            const token_in = zero_address;
            const token_out = token_contract.address;
            const nonce = "12345678";

            const message = await bridge_contract.getTransactionMessage(recipient, amount, source_chain, destination_chain, token_in, token_out, nonce);
            const messageHashBuffer = Buffer(message.replace("0x", ""), "hex")

            // sign the message - with all validators
            const signature1 = await validators[0].signMessage(messageHashBuffer);
            const signature2 = await validators[1].signMessage(messageHashBuffer);
            const signature3 = await validators[2].signMessage(messageHashBuffer);

            await bridge_contract.connect(validators[2]).completeTransfer(recipient, amount, source_chain, destination_chain, token_in, token_out, nonce, [signature1, signature2, signature3]);
        } catch (error) {
            assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Transfer not allowed or amount exceeds maximum allowed'", "Invalid error message");
        }
    });

    it("CompleteTransfer [FAIL] - invalid signatures", async function () {
        try {
            const recipient = bridge_user.address;
            const amount = 100;
            const token_in = zero_address;
            const token_out = token_contract.address;
            const nonce = "12345678";

            const message = await bridge_contract.getTransactionMessage(recipient, amount, source_chain, destination_chain, token_in, token_out, nonce);
            const messageHashBuffer = Buffer(message.replace("0x", ""), "hex")

            // sign the message - with only one validator
            const signature1 = await validators[0].signMessage(messageHashBuffer);
            const signature2 = await bridge_user.signMessage(messageHashBuffer);
            const signature3 = await deployer.signMessage(messageHashBuffer);

            await bridge_contract.connect(validators[2]).completeTransfer(recipient, amount, source_chain, destination_chain, token_in, token_out, nonce, [signature1, signature2, signature3]);
        } catch (error) {
            assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Invalid signatures'", "Invalid error message");
        }
    });

    it("CompleteTransfer [FAIL] - one validator sends 3 signatures", async function () {
        try {
            const recipient = bridge_user.address;
            const amount = 100;
            const token_in = zero_address;
            const token_out = token_contract.address;
            const nonce = "12345678";

            const message = await bridge_contract.getTransactionMessage(recipient, amount, source_chain, destination_chain, token_in, token_out, nonce);
            const messageHashBuffer = Buffer(message.replace("0x", ""), "hex")

            // sign the message - with only one validator
            const signature1 = await validators[0].signMessage(messageHashBuffer);

            await bridge_contract.connect(validators[2]).completeTransfer(recipient, amount, source_chain, destination_chain, token_in, token_out, nonce, [signature1, signature1, signature1]);
        } catch (error) {
            assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Invalid signatures'", "Invalid error message");
        }
    });

    it("CompleteTransfer [SUCCESS] - complete transfer (Wrapped)", async function () {
        try {
            const recipient = bridge_user.address;
            const amount = 100;
            const token_in = zero_address;
            const token_out = token_contract.address;
            const nonce = "12345678";

            // check user balance before the transfer
            const user_before = await token_contract.balanceOf(bridge_user.address);

            // check contract balance before the transfer
            const contract_balance_before = await token_contract.balanceOf(bridge_contract.address);

            const message = await bridge_contract.getTransactionMessage(recipient, amount, source_chain, destination_chain, token_in, token_out, nonce);
            const messageHashBuffer = Buffer(message.replace("0x", ""), "hex")

            // sign the message - with all validators
            const signature1 = await validators[0].signMessage(messageHashBuffer);
            const signature2 = await validators[1].signMessage(messageHashBuffer);
            const signature3 = await validators[2].signMessage(messageHashBuffer);

            const transaction = await bridge_contract.connect(validators[2]).completeTransfer(recipient, amount, source_chain, destination_chain, token_in, token_out, nonce, [signature1, signature2, signature3]);

            // check user balance after the transfer
            const user_after = await token_contract.balanceOf(bridge_user.address);
            assert.equal(user_after.toString(), user_before.add(amount).toString(), "Invalid balance");

            // check contract balance after the transfer
            const contract_balance_after = await token_contract.balanceOf(bridge_contract.address);
            assert.equal(contract_balance_after.toString(), contract_balance_before.sub(amount).toString(), "Invalid balance");
        } catch (error) {
            assert.strictEqual(error.message, "", "There was an error");
        }

    });

    it("CompleteTransfer [FAIL] - cannot transfer again with same signatures and nonce", async function () {
        try {
            const recipient = bridge_user.address;
            const amount = 100;
            const token_in = zero_address;
            const token_out = token_contract.address;
            const nonce = "12345678";

            const message = await bridge_contract.getTransactionMessage(recipient, amount, source_chain, destination_chain, token_in, token_out, nonce);
            const messageHashBuffer = Buffer(message.replace("0x", ""), "hex")

            // sign the message - with all validators
            const signature1 = await validators[0].signMessage(messageHashBuffer);
            const signature2 = await validators[1].signMessage(messageHashBuffer);
            const signature3 = await validators[2].signMessage(messageHashBuffer);


            const transaction = await bridge_contract.connect(validators[2]).completeTransfer(recipient, amount, source_chain, destination_chain, token_in, token_out, nonce, [signature1, signature2, signature3]);
        } catch (error) {
            assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Transfer already completed'", "Invalid error message");
        }
    });

    it("CompleteTransfer [SUCCESS] - complete transfer (Native)", async function () {
        try {
            const recipient = bridge_user.address;
            const amount = 100;
            const token_in = token_contract.address;
            const token_out = zero_address;
            const nonce = "87654321";

            // check user balance before the transfer
            const user_before = await provider.getBalance(bridge_user.address);

            // check contract balance before the transfer
            const contract_balance_before = await provider.getBalance(bridge_contract.address);

            const message = await bridge_contract.getTransactionMessage(recipient, amount, source_chain, destination_chain, token_in, token_out, nonce);
            const messageHashBuffer = Buffer(message.replace("0x", ""), "hex")

            // sign the message - with all validators
            const signature1 = await validators[0].signMessage(messageHashBuffer);
            const signature2 = await validators[1].signMessage(messageHashBuffer);
            const signature3 = await validators[2].signMessage(messageHashBuffer);

            const transaction = await bridge_contract.connect(validators[2]).completeTransfer(recipient, amount, source_chain, destination_chain, token_in, token_out, nonce, [signature1, signature2, signature3]);

            // check user balance after the transfer
            const user_after = await provider.getBalance(bridge_user.address);
            assert.equal(user_after.toString(), user_before.add(amount).toString(), "Invalid balance");

            // check contract balance after the transfer
            const contract_balance_after = await provider.getBalance(bridge_contract.address);
            assert.equal(contract_balance_after.toString(), contract_balance_before.sub(amount).toString(), "Invalid balance");
        } catch (error) {
            assert.strictEqual(error.message, "", "There was an error");
        }
    });

});