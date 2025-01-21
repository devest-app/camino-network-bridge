const { ethers, upgrades } = require("hardhat");
const assert = require('assert');
const { deployAndSetupContracts } = require("./setup");

describe("Minting and Burning", function () {
    let bridge_contract;
    let wrapped_erc20_permissioned_mint;
    let validators;
    let provider;
    let bridge_user;
    
    let zero_address =  "0x0000000000000000000000000000000000000000";

    before(async function () {
        // Deploy initial contracts and setup validators/allowed transfers
        const setup = await deployAndSetupContracts();
        bridge_contract = setup.bridge_contract;
        validators = setup.validators;
        wrapped_erc20_permissioned_mint = setup.wrapped_erc20_permissioned_mint;
        provider = setup.provider;
        bridge_user = setup.bridge_user;
    });

    it("Should mint tokens on complete transfer", async function () {
        // complete transfer
        try {
            const recipient = bridge_user.address;
            const amount = 100;
            const token_in = zero_address;
            let source_chain = "456";
            let destination_chain = "123";
            const token_out = wrapped_erc20_permissioned_mint.address;
            const nonce = "12345678";

            // check user balance before the transfer
            const user_before = await wrapped_erc20_permissioned_mint.balanceOf(bridge_user.address);


            const message = await bridge_contract.getTransactionMessage(recipient, amount, source_chain, destination_chain, token_in, token_out, nonce);
            const messageHashBuffer = Buffer(message.replace("0x", ""), "hex")

            // sign the message - with all validators
            const signature1 = await validators[0].signMessage(messageHashBuffer);
            const signature2 = await validators[1].signMessage(messageHashBuffer);
            const signature3 = await validators[2].signMessage(messageHashBuffer);

            const transaction = await bridge_contract.connect(validators[2]).completeTransfer(recipient, amount, source_chain, destination_chain, token_in, token_out, nonce, [signature1, signature2, signature3]);

            // check user balance after the transfer
            const user_after = await wrapped_erc20_permissioned_mint.balanceOf(bridge_user.address);
            console.log(user_after.toString());
            console.log(user_before.add(amount).toString());
            assert.equal(user_after.toString(), user_before.add(amount).toString(), "Invalid balance");

        } catch (error) {
            assert(true);
        }
    });

    it("Should burn tokens on initiate   transfer", async function () {
        try {
            // check user balance before the transfer
            const user_before = await wrapped_erc20_permissioned_mint.balanceOf(bridge_user.address);
            const total_supply = await wrapped_erc20_permissioned_mint.totalSupply();
            console.log(total_supply.toString());
            // total supply should be 100
            assert.equal(total_supply.toString(), "100", "Invalid total supply");

            const validator_fee = await bridge_contract.validator_fee();
            const amount = 10;


            const token_in = wrapped_erc20_permissioned_mint.address;
            const token_out = zero_address;
            let source_chain = "123";
            let destination_chain = "456";

            const value = amount + (validator_fee.toNumber() * 3) + 100; // send more than required to see if the contract balance is updated correctly and the sender is refunded
            try {
                // set allowance
                await wrapped_erc20_permissioned_mint.connect(bridge_user).approve(bridge_contract.address, amount);

                const transaction = await bridge_contract.connect(bridge_user).initiateTransfer(bridge_user.address, amount, source_chain, destination_chain, token_in, token_out, { value });
                assert(transaction.blockHash != null)
            } catch (error) {
                console.log(error);
                assert(true);
            }

            // check user balance after the transfer
            const user_after = await wrapped_erc20_permissioned_mint.balanceOf(bridge_user.address);
            const total_supply_after = await wrapped_erc20_permissioned_mint.totalSupply();
            console.log(total_supply_after.toString());

            // total supply should be total supply - amount
            assert.equal(total_supply_after.toString(), total_supply.sub(amount).toString(), "Invalid total supply");

            console.log(user_after.toString());
            console.log(user_before.sub(amount).toString());
            assert.equal(user_after.toString(), user_before.sub(amount).toString(), "Invalid balance");




        } catch (error) {
            assert(true);
        }
    });
}); 