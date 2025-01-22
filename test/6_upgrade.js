const { ethers, upgrades } = require("hardhat");
const assert = require('assert');
const { deployAndSetupContracts } = require("./setup");

describe("DvBridge Upgrade", function () {
    let bridge_contract;
    let token_contract;
    let validators;
    let DvBridgeV2;
    let new_implementation;
    let provider;

    before(async function () {
        // Deploy initial contracts and setup validators/allowed transfers
        const setup = await deployAndSetupContracts();
        bridge_contract = setup.bridge_contract;
        validators = setup.validators;
        token_contract = setup.token_contract;
        provider = setup.provider;

        // Get the V2 contract factory
        DvBridgeV2 = await ethers.getContractFactory("DvBridgeV2");

        new_implementation = await upgrades.deployImplementation(DvBridgeV2, {
            constructorArgs: [],
            initializer: false
        });
    });

    it("Should preserve validators and balance after upgrade", async function () {
        // get validators before upgrade

        // check balance of the bridge contract
        const balance_before = await provider.getBalance(bridge_contract.address);

        const validatorsBefore = await bridge_contract.getValidators();
        const initializeData = DvBridgeV2.interface.encodeFunctionData("initialize2", []);

        // Create upgrade message and get signatures
        const nonce = ethers.utils.formatBytes32String("upgrade_v2");
        const message = await bridge_contract.getUpgradeMessage(new_implementation, nonce);
        const messageHashBuffer = Buffer.from(message.slice(2), "hex");

        // Get signatures from all validators
        const signature1 = await validators[0].signMessage(messageHashBuffer);
        const signature2 = await validators[1].signMessage(messageHashBuffer);
        const signature3 = await validators[2].signMessage(messageHashBuffer);

        // Upgrade using the contract's upgrade function
        await bridge_contract.connect(validators[0]).upgradeToWithSignatures(
            new_implementation,
            initializeData,
            nonce,
            [signature1, signature2, signature3]
        );

        // Get contract instance with new ABI
        const upgradedBridge = await ethers.getContractAt("DvBridgeV2", bridge_contract.address);

        // balnce after
        const balance_after = await provider.getBalance(upgradedBridge.address);
        assert.equal(balance_after.toNumber(), balance_before.toNumber());
        console.log(balance_after.toNumber());

        // get validators after upgrade
        const validatorsAfter = await upgradedBridge.getValidators();

        // Verify validators are preserved
        assert.equal(validatorsAfter[0], validatorsBefore[0]);
        assert.equal(validatorsAfter[1], validatorsBefore[1]);
        assert.equal(validatorsAfter[2], validatorsBefore[2]);
    });

    it("Should preserve allowed transfers after upgrade", async function () {
        const upgradedBridge = await ethers.getContractAt("DvBridgeV2", bridge_contract.address);
        
        // Check allowed transfer for ETH -> Token
        const transfer1 = await upgradedBridge.getAllowedTransfer(
            "123", // source chain
            "321", // destination chain
            token_contract.address // token out
        );
        assert.equal(transfer1.active, true);

        // Check allowed transfer for Token -> ETH
        const transfer2 = await upgradedBridge.getAllowedTransfer(
            "123", // source chain
            "321", // destination chain
            "0x0000000000000000000000000000000000000000" // token out (ETH)
        );
        assert.equal(transfer2.active, true);
    });


    it("Cannot run the same initialize function twice", async function () {
        try {
            
            const validatorsBefore = await bridge_contract.getValidators();
            const initializeData = DvBridgeV2.interface.encodeFunctionData("initialize2", []);

            // Create upgrade message and get signatures
            const nonce = ethers.utils.formatBytes32String("upgrade_v2_2");
            const message = await bridge_contract.getUpgradeMessage(new_implementation, nonce);
            const messageHashBuffer = Buffer.from(message.slice(2), "hex");

            // Get signatures from all validators
            const signature1 = await validators[0].signMessage(messageHashBuffer);
            const signature2 = await validators[1].signMessage(messageHashBuffer);
            const signature3 = await validators[2].signMessage(messageHashBuffer);

            // Upgrade using the contract's upgrade function
            await bridge_contract.connect(validators[0]).upgradeToWithSignatures(
                new_implementation,
                initializeData,
                nonce,
                [signature1, signature2, signature3]
            );
            assert(false);
        } catch (error) {
            assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with custom error 'InvalidInitialization()'", "Invalid error message");
        }
    });

    it("Should be able to use new functionality after upgrade", async function () {
        const upgradedBridge = await ethers.getContractAt("DvBridgeV2", bridge_contract.address);
        const version = await upgradedBridge.getVersion();
        assert.equal(version, "2.0");
    });

    it("Should not be able to call upgradeToAndCall", async function () {
        try {
            const initializeData = DvBridgeV2.interface.encodeFunctionData("initialize2", []);

            // Create upgrade message and get signatures
            const nonce = ethers.utils.formatBytes32String("upgrade_v2_2");
            const message = await bridge_contract.connect(validators[0]).upgradeToAndCall(new_implementation, nonce);
            console.log(message);
        } catch (e) {
            assert.strictEqual(e.message, "VM Exception while processing transaction: reverted with reason string 'Upgrade not authorized'", "Invalid error message");
        }
        
    });
}); 