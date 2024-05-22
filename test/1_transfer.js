const { ethers, waffle } = require("hardhat");
const assert = require('assert');
const Web3 = require('web3');
const Helper = require('./helpers/Helper');

describe('Testing Transfers', () => {

  let DvBridge;
  let bridge_contract_camino;
  let accounts = [];
  let deployer;
  let web3;
  const provider = waffle.provider;

  before(async () => {
    DvBridge = await ethers.getContractFactory("DvBridge");



    const [_deployer, account1, account2, account3] = await ethers.getSigners();
    deployer = _deployer;
    accounts.push(account1);
    accounts.push(account2);
    accounts.push(account3);


    bridge_contract_camino = await DvBridge.deploy(123, [Helper.publicAddress1, Helper.publicAddress2, Helper.publicAddress3, account3.address]);
    await bridge_contract_camino.deployed();
    bridge_contract_polygon = await DvBridge.deploy(321, [Helper.publicAddress1, Helper.publicAddress2, Helper.publicAddress3, account3.address]);
    await bridge_contract_polygon.deployed();


    await deployer.sendTransaction({to: bridge_contract_polygon.address, value: 1000000});
    await deployer.sendTransaction({to: bridge_contract_camino.address, value: 1000000});
    
    web3 = new Web3.Web3();

  });


  it("InitializeTransfer - Should fail if recipient is zero address", async function () {
    try {
      const transaction = await bridge_contract_camino.connect(accounts[1]).initiateTransfer(Helper.zeroAddress, 100, 123, "1234", Helper.zeroAddress, Helper.zeroAddress);
      console.log(transaction);
    } catch (error) {
      assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Recipient cannot be zero address'", "Invalid error message");
    }
  });

  it("InitializeTransfer - Should fail if amount is zero", async function () {
    try {
      const transaction = await bridge_contract_camino.connect(accounts[1]).initiateTransfer(Helper.publicAddress1, 0, 123, "1234", Helper.zeroAddress, Helper.zeroAddress);
      console.log(transaction);
    } catch (error) {
      assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Amount cannot be zero'", "Invalid error message");
    }
  });

  it("InitializeTransfer - Should fail if source chain is incorrect", async function () {
    try {
      const transaction = await bridge_contract_camino.connect(accounts[1]).initiateTransfer(Helper.publicAddress1, 100, 321, "1234", Helper.zeroAddress, Helper.zeroAddress);
      console.log(transaction);
    } catch (error) {
      assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Invalid source chain'", "Invalid error message");
    }
  });

  it("InitializeTransfer - Should successfully initiate transfer", async function () {

    const balance_before = await provider.getBalance(bridge_contract_camino.address);

    const amount = 100;

    const transaction = await bridge_contract_camino.connect(accounts[2]).initiateTransfer(Helper.publicAddress1, amount, "123", "321", Helper.zeroAddress, Helper.zeroAddress,
    { value: amount });
    assert(transaction.blockHash != null)

    const balance_after = await provider.getBalance(bridge_contract_camino.address);
    // check that the contract has the correct balance
    assert.equal(balance_after.toNumber(), balance_before.toNumber() + amount, "Invalid balance");
  });

  it("CompleteTransfer - Should fail if sender is not a validator", async function () {
    try {
      const transaction = await bridge_contract_polygon.connect(accounts[1]).completeTransfer(Helper.zeroAddress, 100, "123", "321", Helper.zeroAddress, Helper.zeroAddress, "12345678", []);
    } catch (error) {
      assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Not a validator'", "Invalid error message");
    }
  });

  it("CompleteTransfer - Should fail  if recipient is zero address", async function () {
    try {
      const transaction = await bridge_contract_polygon.connect(accounts[2]).completeTransfer(Helper.zeroAddress, 100, "123", "321", Helper.zeroAddress, Helper.zeroAddress, "12345678", []);
    } catch (error) {
      assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Recipient cannot be zero address'", "Invalid error message");
    }
  });

  it("CompleteTransfer - Should fail if amount is zero", async function () {
    try {
      const transaction = await bridge_contract_polygon.connect(accounts[2]).completeTransfer(Helper.publicAddress1, 0, "123", "321", Helper.zeroAddress, Helper.zeroAddress, "12345678", []);
    } catch (error) {
      assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Amount cannot be zero'", "Invalid error message");
    }
  });

  it("CompleteTransfer - Should fail if destination chain is incorrect", async function () {
    try {
      const transaction = await bridge_contract_polygon.connect(accounts[2]).completeTransfer(Helper.publicAddress1, 100, "123", "3213", Helper.zeroAddress, Helper.zeroAddress, "12345678", []);
    } catch (error) {
      assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Invalid destination chain'", "Invalid error message");
    }
  });

  it("CompleteTransfer - Should fail if signatures are invalid", async function () {
    try {
      const recipient = Helper.publicAddress1;
      let amount = 100;
      const source_chain = "123";
      const destionation_chain = "321";
      const token_in = Helper.zeroAddress;
      const token_out = Helper.zeroAddress;
      const nonce = "12345678";

      const valid_transaction = await bridge_contract_polygon.getTransactionMessage(recipient, amount, source_chain, destionation_chain, token_in, token_out, nonce);  

      // use web3 to sign the message
      const signature1 = web3.eth.accounts.sign(valid_transaction, "0x" + Helper.privateKey1);      
      const signature2 = web3.eth.accounts.sign(valid_transaction, "0x" + Helper.privateKey2);      
      const signature3 = web3.eth.accounts.sign(valid_transaction + "invalid part", "0x" + Helper.privateKey3);      

      const transaction = await bridge_contract_polygon.connect(accounts[2]).completeTransfer(Helper.publicAddress1, 100, "123", "321", Helper.zeroAddress, Helper.zeroAddress, "12345678", [signature1.signature, signature2.signature, signature3.signature]);
    } catch (error) {
      assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Invalid signatures'", "Invalid error message");
    }
  });

  it("CompleteTransfer - Should complete transfer", async function () {
      const recipient = Helper.publicAddress1;
      const amount = 1000;
      const source_chain = "123";
      const destionation_chain = "321";
      const token_in = Helper.zeroAddress;
      const token_out = Helper.zeroAddress;
      const nonce = "12345678";


      const valid_transaction = await bridge_contract_polygon.getTransactionMessage(recipient, amount, source_chain, destionation_chain, token_in, token_out, nonce);  

      // use web3 to sign the message
      const signature1 = web3.eth.accounts.sign(valid_transaction, "0x" + Helper.privateKey1);      
      const signature2 = web3.eth.accounts.sign(valid_transaction, "0x" + Helper.privateKey2);      
      const signature3 = web3.eth.accounts.sign(valid_transaction, "0x" + Helper.privateKey3);      

      const contract_balance_before = await provider.getBalance(bridge_contract_polygon.address);
      // check that the contract has the correct balance

      // transfer the funds to the contract
  
      try {

        // transfer the funds to the contract
        const transfer = await bridge_contract_polygon.connect(accounts[2]).completeTransfer(Helper.publicAddress1, amount, "123", "321", Helper.zeroAddress, Helper.zeroAddress, "12345678", 
        [signature1.signature, signature2.signature, signature3.signature]);
        console.log("Transfer:", transfer);
      } catch (error) {
        console.log(error);
      }

      const contract_balance_after = await provider.getBalance(bridge_contract_polygon.address);
      assert.equal(contract_balance_after, contract_balance_before - amount, "Invalid balance");
  });

  it("CompleteTransfer - Can not transfer again", async function () {

    const recipient = Helper.publicAddress1;
    const amount = 10000;
    const source_chain = "123";
    const destionation_chain = "321";
    const token_in = Helper.zeroAddress;
    const token_out = Helper.zeroAddress;
    const nonce = "12345678";


    const valid_transaction = await bridge_contract_polygon.getTransactionMessage(recipient, amount, source_chain, destionation_chain, token_in, token_out, nonce);  

    // use web3 to sign the message
    const signature1 = web3.eth.accounts.sign(valid_transaction, "0x" + Helper.privateKey1);      
    const signature2 = web3.eth.accounts.sign(valid_transaction, "0x" + Helper.privateKey2);      
    const signature3 = web3.eth.accounts.sign(valid_transaction, "0x" + Helper.privateKey3);      

    try {

      // transfer the funds to the contract
      const transfer = await bridge_contract_polygon.connect(accounts[2]).completeTransfer(Helper.publicAddress1, amount, "123", "321", Helper.zeroAddress, Helper.zeroAddress, "12345678", 
      [signature1.signature, signature2.signature, signature3.signature]);
    } catch (error) {
      assert.strictEqual(error.message, "VM Exception while processing transaction: reverted with reason string 'Transfer already completed'", "Invalid error message");
    }

  });


});

