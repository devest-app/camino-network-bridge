const { ethers, waffle } = require("hardhat");
const assert = require('assert');
const Web3 = require('web3');
const Helper = require('./helpers/Helper');

describe('Tests', () => {

  let DvBridge;
  let bridge_contract_camino;
  let accounts = [];
  let deployer;
  let web3;
  const provider = waffle.provider;

  // Before all tests, deploy the contracts and set initial states
  before(async () => {
    DvBridge = await ethers.getContractFactory("DvBridge");

    const [_deployer, account1, account2, account3] = await ethers.getSigners();
    deployer = _deployer;
    accounts.push(account1);
    accounts.push(account2);
    accounts.push(account3);

    bridge_contract_camino = await DvBridge.deploy(123, "80", [Helper.publicAddress1, Helper.publicAddress2, Helper.publicAddress3, account3.address]);
    await bridge_contract_camino.deployed();
    bridge_contract_polygon = await DvBridge.deploy(321, "80", [Helper.publicAddress1, Helper.publicAddress2, Helper.publicAddress3, account3.address]);
    await bridge_contract_polygon.deployed();

    await deployer.sendTransaction({to: bridge_contract_polygon.address, value: 1000000});
    await deployer.sendTransaction({to: bridge_contract_camino.address, value: 1000000});

    await bridge_contract_camino.connect(accounts[2]).setAllowedTransfer(321, Helper.zeroAddress, Helper.zeroAddress, true, 100);
    await bridge_contract_polygon.connect(accounts[2]).setAllowedTransfer(321, Helper.zeroAddress, Helper.zeroAddress, true, 100);
    
    web3 = new Web3.Web3();
  });

  it("InitializeTransfer - Should fail if recipient is zero address", async function () {
    try {
      await bridge_contract_camino.connect(accounts[1]).initiateTransfer(Helper.zeroAddress, 100, 123, "1234", Helper.zeroAddress, Helper.zeroAddress);
    } catch (error) {
      assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Recipient cannot be zero address'", "Invalid error message");
    }
  });

  it("InitializeTransfer - Should fail if amount is zero", async function () {
    try {
      await bridge_contract_camino.connect(accounts[1]).initiateTransfer(Helper.publicAddress1, 0, 123, "1234", Helper.zeroAddress, Helper.zeroAddress);
    } catch (error) {
      assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Amount cannot be zero'", "Invalid error message");
    }
  });

  it("InitializeTransfer - Should fail if source chain is incorrect", async function () {
    try {
      await bridge_contract_camino.connect(accounts[1]).initiateTransfer(Helper.publicAddress1, 100, 321, "1234", Helper.zeroAddress, Helper.zeroAddress);
    } catch (error) {
      assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Invalid source chain'", "Invalid error message");
    }
  });

  it("InitializeTransfer - Should successfully initiate transfer", async function () {
    const balance_before = await provider.getBalance(bridge_contract_camino.address);
    const validator_fee = await bridge_contract_camino.validator_fee();
    const amount = 100;

    const transaction = await bridge_contract_camino.connect(accounts[2]).initiateTransfer(Helper.publicAddress1, amount, "123", "321", Helper.zeroAddress, Helper.zeroAddress, { value: amount + validator_fee.toNumber() });
    assert(transaction.blockHash != null)

    const balance_after = await provider.getBalance(bridge_contract_camino.address);
    assert.equal(balance_after.toNumber(), balance_before.toNumber() + amount, "Invalid balance");
  });

  it("InitializeTransfer - Should not initiate transfer - amount exceeds max amount", async function () {
    const balance_before = await provider.getBalance(bridge_contract_camino.address);
    const validator_fee = await bridge_contract_camino.validator_fee();
    const amount = 101;
    try {
      await bridge_contract_camino.connect(accounts[2]).initiateTransfer(Helper.publicAddress1, amount, "123", "321", Helper.zeroAddress, Helper.zeroAddress, { value: amount + validator_fee.toNumber() });
    } catch (error) {
      assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Transfer not allowed or amount exceeds maximum allowed'", "Invalid error message");
    }
    const balance_after = await provider.getBalance(bridge_contract_camino.address);
    assert.equal(balance_after.toNumber(), balance_before.toNumber(), "Invalid balance");
  });

  it("Validator Rewards - All validators should have been rewarded", async function () {
    const balance_1 = await provider.getBalance(Helper.publicAddress1);
    const balance_2 = await provider.getBalance(Helper.publicAddress2);
    const balance_3 = await provider.getBalance(Helper.publicAddress3);
    const balance_4 = await provider.getBalance(accounts[2].address);

    assert.equal(balance_1.toNumber(), 20, "Invalid balance");
    assert.equal(balance_2.toNumber(), 20, "Invalid balance");
    assert.equal(balance_3.toNumber(), 20, "Invalid balance");
    assert.notEqual(balance_4.toBigInt(), 0, "Invalid balance");
  });

  it("CompleteTransfer - Should fail if sender is not a validator", async function () {
    try {
      await bridge_contract_polygon.connect(accounts[1]).completeTransfer(Helper.zeroAddress, 100, "123", "321", Helper.zeroAddress, Helper.zeroAddress, "12345678", []);
    } catch (error) {
      assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Not a validator'", "Invalid error message");
    }
  });

  it("CompleteTransfer - Should fail if recipient is zero address", async function () {
    try {
      await bridge_contract_polygon.connect(accounts[2]).completeTransfer(Helper.zeroAddress, 100, "123", "321", Helper.zeroAddress, Helper.zeroAddress, "12345678", []);
    } catch (error) {
      assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Recipient cannot be zero address'", "Invalid error message");
    }
  });

  it("CompleteTransfer - Should fail if amount is zero", async function () {
    try {
      await bridge_contract_polygon.connect(accounts[2]).completeTransfer(Helper.publicAddress1, 0, "123", "321", Helper.zeroAddress, Helper.zeroAddress, "12345678", []);
    } catch (error) {
      assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Amount cannot be zero'", "Invalid error message");
    }
  });

  it("CompleteTransfer - Should fail if destination chain is incorrect", async function () {
    try {
      await bridge_contract_polygon.connect(accounts[2]).completeTransfer(Helper.publicAddress1, 100, "123", "3213", Helper.zeroAddress, Helper.zeroAddress, "12345678", []);
    } catch (error) {
      assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Invalid destination chain'", "Invalid error message");
    }
  });

  it("CompleteTransfer - Should fail if signatures are invalid", async function () {
    try {
      const recipient = Helper.publicAddress1;
      const amount = 100;
      const source_chain = "123";
      const destination_chain = "321";
      const token_in = Helper.zeroAddress;
      const token_out = Helper.zeroAddress;
      const nonce = "12345678";

      const valid_transaction = await bridge_contract_polygon.getTransactionMessage(recipient, amount, source_chain, destination_chain, token_in, token_out, nonce);  

      const signature1 = web3.eth.accounts.sign(valid_transaction, "0x" + Helper.privateKey1);      
      const signature2 = web3.eth.accounts.sign(valid_transaction, "0x" + Helper.privateKey2);      
      const signature3 = web3.eth.accounts.sign(valid_transaction + "invalid part", "0x" + Helper.privateKey3);      

      await bridge_contract_polygon.connect(accounts[2]).completeTransfer(Helper.publicAddress1, 100, "123", "321", Helper.zeroAddress, Helper.zeroAddress, nonce, [signature1.signature, signature2.signature, signature3.signature]);
    } catch (error) {
      assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Invalid signatures'", "Invalid error message");
    }
  });

  it("CompleteTransfer - Should complete transfer", async function () {
    const recipient = Helper.publicAddress1;
    const amount = 100;
    const source_chain = "123";
    const destination_chain = "321";
    const token_in = Helper.zeroAddress;
    const token_out = Helper.zeroAddress;
    const nonce = "12345678";

    const valid_transaction = await bridge_contract_polygon.getTransactionMessage(recipient, amount, source_chain, destination_chain, token_in, token_out, nonce);  

    const signature1 = web3.eth.accounts.sign(valid_transaction, "0x" + Helper.privateKey1);      
    const signature2 = web3.eth.accounts.sign(valid_transaction, "0x" + Helper.privateKey2);      
    const signature3 = web3.eth.accounts.sign(valid_transaction, "0x" + Helper.privateKey3);      

    const contract_balance_before = await provider.getBalance(bridge_contract_polygon.address);

    await bridge_contract_polygon.connect(accounts[2]).completeTransfer(Helper.publicAddress1, amount, "123", "321", Helper.zeroAddress, Helper.zeroAddress, nonce, [signature1.signature, signature2.signature, signature3.signature]);

    const contract_balance_after = await provider.getBalance(bridge_contract_polygon.address);
    assert.equal(contract_balance_after, contract_balance_before - amount, "Invalid balance");
  });

  it("CompleteTransfer - Cannot transfer again", async function () {
    const recipient = Helper.publicAddress1;
    const amount = 100;
    const source_chain = "123";
    const destination_chain = "321";
    const token_in = Helper.zeroAddress;
    const token_out = Helper.zeroAddress;
    const nonce = "12345678";

    const valid_transaction = await bridge_contract_polygon.getTransactionMessage(recipient, amount, source_chain, destination_chain, token_in, token_out, nonce);  

    const signature1 = web3.eth.accounts.sign(valid_transaction, "0x" + Helper.privateKey1);      
    const signature2 = web3.eth.accounts.sign(valid_transaction, "0x" + Helper.privateKey2);      
    const signature3 = web3.eth.accounts.sign(valid_transaction, "0x" + Helper.privateKey3);      

    try {
      await bridge_contract_polygon.connect(accounts[2]).completeTransfer(Helper.publicAddress1, amount, "123", "321", Helper.zeroAddress, Helper.zeroAddress, nonce, [signature1.signature, signature2.signature, signature3.signature]);
    } catch (error) {
      assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Transfer already completed'", "Invalid error message");
    }
  });

  it("Locking - Should fail if sender is not a validator", async function () {
    try {
      await bridge_contract_polygon.connect(accounts[1]).lock();
    } catch (error) {
      assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Not a validator'", "Invalid error message");
    }
  });

  it("Locking - Should lock the bridge", async function () {
    const transaction = await bridge_contract_polygon.connect(accounts[2]).lock();
    assert.notEqual(transaction, undefined || null, "Invalid error message");
  });

  it("BridgeLocked - Can transfer only to validator", async function () {
    const recipient = Helper.publicAddress1;
    const amount = 100;
    const source_chain = "123";
    const destination_chain = "321";
    const token_in = Helper.zeroAddress;
    const token_out = Helper.zeroAddress;
    const nonce = "123456718";

    const valid_transaction = await bridge_contract_polygon.getTransactionMessage(recipient, amount, source_chain, destination_chain, token_in, token_out, nonce);  

    const signature1 = web3.eth.accounts.sign(valid_transaction, "0x" + Helper.privateKey1);      
    const signature2 = web3.eth.accounts.sign(valid_transaction, "0x" + Helper.privateKey2);      
    const signature3 = web3.eth.accounts.sign(valid_transaction, "0x" + Helper.privateKey3);      

    const contract_balance_before = await provider.getBalance(bridge_contract_polygon.address);

    try {
      await bridge_contract_polygon.connect(accounts[2]).completeTransfer(deployer.address, amount, source_chain, destination_chain, Helper.zeroAddress, Helper.zeroAddress, nonce, [signature1.signature, signature2.signature, signature3.signature]);
    } catch (error) {
      assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Recipient is not a validator'", "Invalid error message");
    }

    await bridge_contract_polygon.connect(accounts[2]).completeTransfer(Helper.publicAddress1, amount, source_chain, destination_chain, Helper.zeroAddress, Helper.zeroAddress, nonce, [signature1.signature, signature2.signature, signature3.signature]);
      
    const contract_balance_after = await provider.getBalance(bridge_contract_polygon.address);
    assert.equal(contract_balance_after, contract_balance_before - amount, "Invalid balance");
  });
});
