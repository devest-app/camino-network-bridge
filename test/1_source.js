const assert = require('assert');
const { deployAndSetupContracts } = require("./setup");

describe('Source Gateway - Initiate Transfer', () => {

    let bridge_contract;
    let token_contract;
    let deployer;
    let validators;
    let bridge_user;
    let provider;

    let zero_address = "0x0000000000000000000000000000000000000000";
    let source_chain = 123; // contract chain id
    let destination_chain = 321;

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

    it("InitializeTransfer [FAIL] - recipient is zero address", async function () {
        try {
            await bridge_contract.connect(bridge_user).initiateTransfer(zero_address, 100, source_chain, destination_chain, zero_address, zero_address);
        } catch (error) {
            assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Recipient cannot be zero address'", "Invalid error message");
        }
    });

    it("InitializeTransfer [FAIL] - amount is zero", async function () {
        try {
            await bridge_contract.connect(bridge_user).initiateTransfer(bridge_user.address, 0, source_chain, destination_chain, zero_address, zero_address);
        } catch (error) {
            assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Amount cannot be zero'", "Invalid error message");
        }
    });

    it("InitializeTransfer [FAIL] - source chain is incorrect", async function () {
        try {
            await bridge_contract.connect(bridge_user).initiateTransfer(bridge_user.address, 100, 3211, destination_chain, zero_address, token_contract.address);
        } catch (error) {
            assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Invalid source chain'", "Invalid error message");
        }
    });

    it("InitializeTransfer [FAIL] - insufficient balance provided", async function () {
        try {
            const validator_fee = await bridge_contract.validator_fee();
            const amount = 10;
            const token_in = token_contract.address
            const token_out = "0x0000000000000000000000000000000000000000";

            const transaction = await bridge_contract.connect(bridge_user).initiateTransfer(bridge_user.address, amount, source_chain, destination_chain, token_in, token_out, { value: amount + (validator_fee.toNumber() * 3) });
        } catch (error) {
            assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Insufficient allowance provided'", "Invalid error message");
        }
    });

    it("InitializeTransfer [FAIL] - transfer is not allowed", async function () {
        try {
            const validator_fee = await bridge_contract.validator_fee();
            const amount = 10;
            const token_in = token_contract.address
            const token_out = "0x0000000000000000000000000000000000000001";

            const transaction = await bridge_contract.connect(bridge_user).initiateTransfer(bridge_user.address, amount, source_chain, destination_chain, token_in, token_out, { value: amount + (validator_fee.toNumber() * 3) });

        } catch (error) {
            assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Transfer not allowed or amount exceeds maximum allowed'", "Invalid error message");
        }
    });

    it("InitializeTransfer [FAIL] - execed maximum amount", async function () {
        try {
            const validator_fee = await bridge_contract.validator_fee();
            const amount = 101;


            const token_out = token_contract.address
            const token_in = "0x0000000000000000000000000000000000000000";

            const transaction = await bridge_contract.connect(bridge_user).initiateTransfer(bridge_user.address, amount, source_chain, destination_chain, token_in, token_out, { value: amount + (validator_fee.toNumber() * 3) });

        } catch (error) {
            assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Transfer not allowed or amount exceeds maximum allowed'", "Invalid error message");
        }
    });

    it("InitializeTransfer [FAIL] (Native) - invalid value sent", async function () {
        try {
            const validator_fee = await bridge_contract.validator_fee();
            const _validators = await bridge_contract.getValidators();
            const amount = 10;


            const token_out = token_contract.address;
            const token_in = "0x0000000000000000000000000000000000000000";

            const value = amount + (validator_fee.toNumber() * _validators.length) - 1; // send more than required to see if the contract balance is updated correctly and the sender is refunded
            const transaction = await bridge_contract.connect(bridge_user).initiateTransfer(bridge_user.address, amount, source_chain, destination_chain, token_in, token_out, { value });

        } catch (error) {
            assert.strictEqual(error.code, "INSUFFICIENT_FUNDS", "Invalid error message");
        }
    });

    it("InitializeTransfer [SUCCESS] - (Native) tokens, validators are paid, any extra tokens sent are returned to sender", async function () {
        try {
            const contract_before = await provider.getBalance(bridge_contract.address);

            // check balance of the validator before the transfer
            const validator1_before = await provider.getBalance(validators[2].address);
            const validator2_before = await provider.getBalance(validators[1].address);
            const validator3_before = await provider.getBalance(validators[0].address);

            // check user balance before the transfer
            const user_before = await provider.getBalance(bridge_user.address);

            const validator_fee = await bridge_contract.validator_fee();
            const amount = 10;


            const token_in = "0x0000000000000000000000000000000000000000";
            const token_out = token_contract.address;


            const value = amount + (validator_fee.toNumber() * 3) + 100; // send more than required to see if the contract balance is updated correctly and the sender is refunded
            const transaction = await bridge_contract.connect(bridge_user).initiateTransfer(bridge_user.address, amount, source_chain, destination_chain, token_in, token_out, { value });
            assert(transaction.blockHash != null)

            // check contract balance after the transfer
            const contract_after = await provider.getBalance(bridge_contract.address); // 
            assert.equal(contract_after.toNumber(), contract_before.toNumber() + amount, "Invalid balance");


            const receipt = await transaction.wait();

            // verify that receipt has an event
            assert(receipt.events.length > 0, "Invalid event");

            // verify that the event is the correct amount
            const event = receipt.events.find(e => e.event == "TransferInitiated");
            assert.equal(event.event, "TransferInitiated", "Invalid event");
            assert.equal(event.args.amount, amount, "Invalid event");

            // check user balance after the transfer
            const user_after = await provider.getBalance(bridge_user.address);
            const total_validator_fee = validator_fee.mul(3);
            const gasPrice = transaction.gasPrice;
            const totalGasCost = receipt.gasUsed.mul(gasPrice);
            const totalTransactionCost = totalGasCost.add(total_validator_fee).add(amount);
            assert.equal(user_after.toString(), user_before.sub(totalTransactionCost).toString(), "Invalid balance");


            // check balance of the validator after the transfer
            const validator1_after = await provider.getBalance(validators[2].address);
            assert.equal(validator1_after.toString(), validator1_before.add(validator_fee).toString(), "Invalid balance");
            const validator2_after = await provider.getBalance(validators[1].address);
            assert.equal(validator2_after.toString(), validator2_before.add(validator_fee).toString(), "Invalid balance");
            const validator3_after = await provider.getBalance(validators[0].address);
            assert.equal(validator3_after.toString(), validator3_before.add(validator_fee).toString(), "Invalid balance");
        } catch (error) {
            assert.strictEqual(error.message, "", "There was an error");
        }
    });

    it("InitializeTransfer [FAIL] (Wrapped) - invalid value sent", async function () {
        try {
            const validator_fee = await bridge_contract.validator_fee();
            const _validators = await bridge_contract.getValidators();
            const amount = 10;


            const token_in = token_contract.address;
            const token_out = "0x0000000000000000000000000000000000000000";


            let approval = await token_contract.connect(bridge_user).approve(bridge_contract.address, amount);
            const approvla_receipt = await approval.wait();

            const value = (validator_fee.toNumber() * _validators.length) - 1; // send more than required to see if the contract balance is updated correctly and the sender is refunded
            const transaction = await bridge_contract.connect(bridge_user).initiateTransfer(bridge_user.address, amount, source_chain, destination_chain, token_in, token_out, { value });
            assert(transaction.blockHash != null)
        } catch (error) {
            assert.strictEqual(error.code, "INSUFFICIENT_FUNDS", "Invalid error message");
        }
    });

    it("InitializeTransfer [SUCCESS] - (Wrapped) tokens, validators are paid, any extra tokens sent are returned to sender", async function () {
        try {
            const contract_before = await token_contract.balanceOf(bridge_contract.address);

            // check balance of the validator before the transfer
            const validator1_before = await provider.getBalance(validators[2].address);
            const validator2_before = await provider.getBalance(validators[1].address);
            const validator3_before = await provider.getBalance(validators[0].address);

            // check user balance before the transfer
            const user_before = await provider.getBalance(bridge_user.address);
            const user_wrapped_before = await token_contract.balanceOf(bridge_user.address);

            const validator_fee = await bridge_contract.validator_fee();
            const _validators = await bridge_contract.getValidators();
            const amount = 10;


            const token_in = token_contract.address;
            const token_out = "0x0000000000000000000000000000000000000000";


            let approval = await token_contract.connect(bridge_user).approve(bridge_contract.address, amount);
            const approvla_receipt = await approval.wait();

            const value = (validator_fee.toNumber() * _validators.length) + 100; // send more than required to see if the contract balance is updated correctly and the sender is refunded
            const transaction = await bridge_contract.connect(bridge_user).initiateTransfer(bridge_user.address, amount, source_chain, destination_chain, token_in, token_out, { value });
            assert(transaction.blockHash != null)

            // check contract balance after the transfer
            const contract_after = await token_contract.balanceOf(bridge_contract.address); // 
            assert.equal(contract_after.toString(), contract_before.add(amount).toString(), "Invalid balance");


            const receipt = await transaction.wait();

            // verify that receipt has an event
            assert(receipt.events.length > 0, "Invalid event");

            // verify that the event is the correct amount
            const event = receipt.events.find(e => e.event == "TransferInitiated");
            assert.equal(event.event, "TransferInitiated", "Invalid event");
            assert.equal(event.args.amount, amount, "Invalid event");

            // check user balance after the transfer
            const user_after = await provider.getBalance(bridge_user.address);
            const total_validator_fee = validator_fee.mul(_validators.length);
            const gasPrice = transaction.gasPrice;
            const totalGasCost = receipt.gasUsed.mul(gasPrice);
            const totalTransactionCost = totalGasCost.add(total_validator_fee);
            const approvalGasCost = approvla_receipt.gasUsed.mul(approval.gasPrice);
            const totalCost = totalTransactionCost.add(approvalGasCost);
            assert.equal(user_after.toString(), user_before.sub(totalCost).toString(), "Invalid balance");

            // check user wrapped balance after the transfer
            const user_wrapped_after = await token_contract.balanceOf(bridge_user.address);
            assert.equal(user_wrapped_after.toString(), user_wrapped_before.sub(amount).toString(), "Invalid balance");

            // check balance of the validator after the transfer
            const validator1_after = await provider.getBalance(validators[2].address);
            assert.equal(validator1_after.toString(), validator1_before.add(validator_fee).toString(), "Invalid balance");
            const validator2_after = await provider.getBalance(validators[1].address);
            assert.equal(validator2_after.toString(), validator2_before.add(validator_fee).toString(), "Invalid balance");
            const validator3_after = await provider.getBalance(validators[0].address);
            assert.equal(validator3_after.toString(), validator3_before.add(validator_fee).toString(), "Invalid balance");
        } catch (error) {
            assert.strictEqual(error.message, "", "There was an error");
        }
    });


});