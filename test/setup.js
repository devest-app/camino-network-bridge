const { ethers, waffle, upgrades } = require("hardhat");

let DvBridge;
let TestToken;
let WrapperdERC20PermissionedMint;

let deployer;
let bridge_user;
let validators = [];
let token_contract;
let wrapped_erc20_permissioned_mint;
let bridge_contract;
let provider = waffle.provider;

async function deployContract() {
    // Get the contract factories
    DvBridge = await ethers.getContractFactory("DvBridge");
    TestToken = await ethers.getContractFactory("TestToken");
    WrappedERC20PermissionedMint = await ethers.getContractFactory("WrapperdERC20PermissionedMint");

    const [_deployer, validator1, validator2, validator3, user] = await ethers.getSigners();
    deployer = _deployer;
    validators.push(validator1);
    validators.push(validator2);
    validators.push(validator3);
    bridge_user = user;

    // Deploy the contracts
    token_contract = await TestToken.deploy("TestToken", "MTK", ethers.utils.parseUnits("1000", 18));
    await token_contract.deployed();
    try {
        // Deploy bridge contract with proxy
        bridge_contract = await upgrades.deployProxy(
            DvBridge,
            ["123", "80", [validator1.address]], // initialization parameters
            { initializer: 'initialize', kind: "uups", unsafeAllow: ['constructor'] },
        );
        await bridge_contract.deployed();
    } catch (error) {
        console.log(error);
    }

    try {
        // Deploy bridge contract with proxy
        wrapped_erc20_permissioned_mint = await upgrades.deployProxy(
            WrappedERC20PermissionedMint,
            ["WrappedERC20PermissionedMint", "WMTK", deployer.address], // initialization parameters
            { initializer: 'initialize', kind: "uups", unsafeAllow: ['constructor'] },
        );
        await wrapped_erc20_permissioned_mint.deployed();
    } catch (error) {
        console.log(error);
    }
   
    // Transfer some tokens to the bridge contracts and some to the user
    await token_contract.transfer(bridge_contract.address, ethers.utils.parseUnits("10", 18));
    await token_contract.transfer(user.address, ethers.utils.parseUnits("10", 18));

    await deployer.sendTransaction({ to: bridge_contract.address, value: 1000000 });
  
  return { bridge_contract, token_contract, deployer, validators, bridge_user, wrapped_erc20_permissioned_mint };
}

async function deployAndSetupContracts() {
    const { 
        bridge_contract, 
        token_contract,
        deployer, 
        validators, 
        bridge_user,
        wrapped_erc20_permissioned_mint
    } = await deployContract();

        // ALLOWED TOKENS SETUP
        // Add token to allowed tokens
        let destination_chain = 321;
        source_chain = 123;
        let token_in = "0x0000000000000000000000000000000000000000";
        let token_out = token_contract.address;
        const active = true;
        const max_amount = 100;
        let nonce = "1";

        // get message for signing
        let message = await bridge_contract.getAllowedTransferMessage(source_chain, destination_chain, token_in, token_out, active, max_amount, nonce);
        let messageHashBuffer = Buffer(message.replace("0x", ""), "hex")

        // sign the message - with all validators
        let signature = await validators[0].signMessage(messageHashBuffer);

        // add token to allowed tokens
        await bridge_contract.connect(validators[0]).setAllowedTransfer(source_chain, destination_chain, token_in, token_out, active, max_amount, nonce, [signature]);

        // Needs reversed as well
        nonce = "2";
        token_in = token_contract.address;
        token_out = "0x0000000000000000000000000000000000000000";

        message = await bridge_contract.getAllowedTransferMessage(source_chain, destination_chain, token_in, token_out, active, max_amount, nonce);
        messageHashBuffer = Buffer(message.replace("0x", ""), "hex")

        // sign the message - with all validators
        signature = await validators[0].signMessage(messageHashBuffer);

        // add token to allowed tokens
        await bridge_contract.connect(validators[0]).setAllowedTransfer(source_chain, destination_chain, token_in, token_out, active, max_amount, nonce, [signature]);

        // Do same for other chain id
        destination_chain = 123;
        source_chain = 321;
        nonce = "3";

        message = await bridge_contract.getAllowedTransferMessage(source_chain, destination_chain, token_in, token_out, active, max_amount, nonce);
        messageHashBuffer = Buffer(message.replace("0x", ""), "hex")

        // sign the message - with all validators
        signature = await validators[0].signMessage(messageHashBuffer);

        // add token to allowed tokens
        await bridge_contract.connect(validators[0]).setAllowedTransfer(source_chain, destination_chain, token_in, token_out, active, max_amount, nonce, [signature]);
        // Needs reversed as well
        nonce = "4";
        token_in = "0x0000000000000000000000000000000000000000";
        token_out = token_contract.address;

        message = await bridge_contract.getAllowedTransferMessage(source_chain, destination_chain, token_in, token_out, active, max_amount, nonce);
        messageHashBuffer = Buffer(message.replace("0x", ""), "hex")

        // sign the message - with all validators
        signature = await validators[0].signMessage(messageHashBuffer);

        // add token to allowed tokens
        await bridge_contract.connect(validators[0]).setAllowedTransfer(source_chain, destination_chain, token_in, token_out, active, max_amount, nonce, [signature]);


        source_chain = 123;
        destination_chain = 456;
        nonce = "5";

        token_in = wrapped_erc20_permissioned_mint.address;
        token_out = "0x0000000000000000000000000000000000000000";

        message = await bridge_contract.getAllowedTransferMessage(source_chain, destination_chain, token_in, token_out, active, max_amount, nonce);
        messageHashBuffer = Buffer(message.replace("0x", ""), "hex")

        // sign the message - with all validators
        signature = await validators[0].signMessage(messageHashBuffer);

        // add wrapped token to allowed tokens
        await bridge_contract.connect(validators[0]).setAllowedTransfer(source_chain, destination_chain, token_in, token_out, active, max_amount, nonce, [signature]);

        // reverse the wrapped token to allowed tokens
        nonce = "6";
        token_in = "0x0000000000000000000000000000000000000000";
        token_out = wrapped_erc20_permissioned_mint.address;
        source_chain = 456;
        destination_chain = 123;

        message = await bridge_contract.getAllowedTransferMessage(source_chain, destination_chain, token_in, token_out, active, max_amount, nonce);
        messageHashBuffer = Buffer(message.replace("0x", ""), "hex")

        // sign the message - with all validators
        signature = await validators[0].signMessage(messageHashBuffer);

        // add wrapped token to allowed tokens
        await bridge_contract.connect(validators[0]).setAllowedTransfer(source_chain, destination_chain, token_in, token_out, active, max_amount, nonce, [signature]);


        try{
            let minter_role = await wrapped_erc20_permissioned_mint.MINTER_ROLE();
            // set token to be mintable
            await wrapped_erc20_permissioned_mint.connect(deployer).grantRole(minter_role, bridge_contract.address);
        } catch (error) {
            console.log(error);
        }

        // set token as mintable on bridge contract

        mintable_token = wrapped_erc20_permissioned_mint.address;

        message = await bridge_contract.getMintableTokenMessage(mintable_token, true, nonce);
        messageHashBuffer = Buffer(message.replace("0x", ""), "hex")

        // sign the message - with all validators
        signature = await validators[0].signMessage(messageHashBuffer);

        await bridge_contract.connect(validators[0]).setMintableToken(mintable_token, true, nonce, [signature]);

        // VALIDATORS SETUP
        // get message for signing
        nonce = "4"
        const vote_type = 1; // 1 - add validator 2 - remove validator

        const messageHash = await bridge_contract.getVoteValidatorMessage(vote_type, validators[1].address, nonce);
        messageHashBuffer = Buffer(messageHash.replace("0x", ""), "hex")

        // sign the message - validators[0] is the only validator
        signature = await validators[0].signMessage(messageHashBuffer);

        // add new validator
        await bridge_contract.connect(validators[0]).voteValidator(vote_type, validators[1].address, nonce, [signature]);

        const nonce2 = "5"

        const messageHash2 = await bridge_contract.getVoteValidatorMessage(vote_type, validators[2].address, nonce2);
        const messageHashBuffer2 = Buffer(messageHash2.replace("0x", ""), "hex")

        const signature1 = await validators[0].signMessage(messageHashBuffer2);
        const signature2 = await validators[1].signMessage(messageHashBuffer2);

        // add new validator
        await bridge_contract.connect(validators[1]).voteValidator(vote_type, validators[2].address, nonce2, [signature1, signature2]);
  
    return { 
        bridge_contract, 
        deployer, 
        validators, 
        bridge_user, 
        token_contract, 
        provider,
        wrapped_erc20_permissioned_mint
    };
};




module.exports = {
    deployContract,
    deployAndSetupContracts
};