/**
 * Bridge Transfer Example
 *
 * Simple example showing how to execute a bridge transfer.
 * This is a quick reference for the basic transfer flow.
 *
 * Usage:
 *   export PRIVATE_KEY=0x...
 *   npx ts-node bridge-example.ts
 */

import { ethers } from 'ethers';

// ============================================================================
// CONFIGURATION
// ============================================================================

// Network RPCs
const RPC_URLS = {
  BNB_TESTNET: 'https://data-seed-prebsc-2-s1.binance.org:8545/',
  COLUMBUS: 'https://columbus.camino.network/ext/bc/C/rpc',
  SEPOLIA: 'https://0xrpc.io/sep'
};

// Bridge Contract Addresses
const BRIDGE_ADDRESSES = {
  97: '0x7CA996573346794d6B5e4aAA624203e325cdE989', // BNB Testnet
  501: '0xffDAf09685e8c42Ed8bcAdaA00fEbcecacC56C8c', // Columbus
  11155111: '0x7A7707bEe60b3904E6748b576F7d65819fb1B783' // Sepolia
};

// Bridge ABI (minimal)
const BRIDGE_ABI = [
  'function initiateTransfer(address recipient, uint256 amount, uint256 source_chain, uint256 destination_chain, address token_in, address token_out) public payable returns (bool)',
  'function validator_fee() public view returns (uint256)',
  'function getValidators() public view returns (address[])',
  'function getAllowedTransfer(uint256 source_chain, uint256 destination_chain, address token_in) public view returns (bool active, uint256 max_amount, address token_out)'
];

// ERC20 ABI (minimal)
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) public returns (bool)',
  'function allowance(address owner, address spender) public view returns (uint256)',
  'function balanceOf(address account) public view returns (uint256)'
];

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// ============================================================================
// EXAMPLE: BNB → Columbus (wCAM → CAM)
// ============================================================================

async function exampleBNBtoColumbus() {
  console.log('\n=== Example: BNB Testnet wCAM → Columbus CAM ===\n');

  // Configuration
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  if (!PRIVATE_KEY) {
    console.error('Error: PRIVATE_KEY environment variable not set');
    process.exit(1);
  }

  const SOURCE_CHAIN_ID = 97; // BNB Testnet
  const DEST_CHAIN_ID = 501; // Columbus
  const TOKEN_IN = '0x7CA996573346794d6B5e4aAA624203e325cdE989'; // wCAM on BNB
  const TOKEN_OUT = ZERO_ADDRESS; // Native CAM on Columbus
  const AMOUNT = '0.1'; // 0.1 wCAM
  const DECIMALS = 18; // wCAM has 18 decimals

  // Setup providers and wallet
  const provider = new ethers.JsonRpcProvider(RPC_URLS.BNB_TESTNET);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const walletAddress = wallet.address;

  console.log(`Wallet: ${walletAddress}`);
  console.log(`\nTransfer Details:`);
  console.log(`  From: BNB Testnet (97) to Columbus (501)`);
  console.log(`  Token: ${AMOUNT} wCAM`);
  console.log(`  Recipient: ${walletAddress}`);

  try {
    // 1. Get bridge contract
    const bridgeContract = new ethers.Contract(
      BRIDGE_ADDRESSES[SOURCE_CHAIN_ID],
      BRIDGE_ABI,
      wallet
    );

    // 2. Check if transfer is allowed
    console.log('\n[1] Checking if transfer is allowed...');
    const allowed = await bridgeContract.getAllowedTransfer(SOURCE_CHAIN_ID, DEST_CHAIN_ID, TOKEN_IN);
    console.log(`    ✓ Transfer allowed: ${allowed[0]}`);
    console.log(`    ✓ Max amount: ${ethers.formatUnits(allowed[1], DECIMALS)}`);

    if (!allowed[0]) {
      console.error('    ✗ Transfer not allowed!');
      return;
    }

    // 3. Get validator fees
    console.log('\n[2] Getting validator fees...');
    const validatorFee = await bridgeContract.validator_fee();
    const validators = await bridgeContract.getValidators();
    const totalFee = validatorFee * BigInt(validators.length);
    const totalFeeEth = ethers.formatEther(totalFee);

    console.log(`    ✓ Validator fee: ${ethers.formatEther(validatorFee)} ETH`);
    console.log(`    ✓ Number of validators: ${validators.length}`);
    console.log(`    ✓ Total fee: ${totalFeeEth} ETH`);

    // 4. Check native balance
    console.log('\n[3] Checking native balance...');
    const nativeBalance = await provider.getBalance(walletAddress);
    const nativeBalanceEth = ethers.formatEther(nativeBalance);
    console.log(`    ✓ Balance: ${nativeBalanceEth} ETH`);

    if (nativeBalance < totalFee) {
      console.error(`    ✗ Insufficient balance for fees!`);
      return;
    }

    // 5. Check token balance
    console.log('\n[4] Checking token balance...');
    const erc20Contract = new ethers.Contract(TOKEN_IN, ERC20_ABI, wallet);
    const tokenBalance = await erc20Contract.balanceOf(walletAddress);
    const tokenBalanceFormatted = ethers.formatUnits(tokenBalance, DECIMALS);
    console.log(`    ✓ Token balance: ${tokenBalanceFormatted} wCAM`);

    const amountBN = ethers.parseUnits(AMOUNT, DECIMALS);
    if (tokenBalance < amountBN) {
      console.error(`    ✗ Insufficient token balance!`);
      return;
    }

    // 6. Check allowance
    console.log('\n[5] Checking token allowance...');
    const currentAllowance = await erc20Contract.allowance(walletAddress, BRIDGE_ADDRESSES[SOURCE_CHAIN_ID]);
    const allowanceFormatted = ethers.formatUnits(currentAllowance, DECIMALS);
    console.log(`    ✓ Current allowance: ${allowanceFormatted} wCAM`);

    if (currentAllowance < amountBN) {
      console.log(`    → Approving token...`);
      const approveTx = await erc20Contract.approve(BRIDGE_ADDRESSES[SOURCE_CHAIN_ID], amountBN);
      console.log(`    → Tx: ${approveTx.hash}`);
      await approveTx.wait();
      console.log(`    ✓ Approval confirmed`);
    }

    // 7. Execute transfer
    console.log('\n[6] Executing transfer...');
    const tx = await bridgeContract.initiateTransfer(
      walletAddress, // recipient
      amountBN, // amount
      SOURCE_CHAIN_ID, // source_chain
      DEST_CHAIN_ID, // destination_chain
      TOKEN_IN, // token_in
      TOKEN_OUT, // token_out
      { value: totalFee }
    );

    console.log(`    → Transfer initiated`);
    console.log(`    → Tx: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`    ✓ Transfer confirmed in block ${receipt?.blockNumber}`);

    console.log('\n✓ Transfer completed successfully!');
    console.log(`\nNext steps:`);
    console.log(`  1. Wait for bridge validators to process the transfer`);
    console.log(`  2. Monitor your Columbus wallet for CAM arrival`);
    console.log(`  3. Check explorer: https://columbus.caminoscan.com`);
  } catch (error) {
    console.error('\n✗ Transfer failed:');
    console.error(error instanceof Error ? error.message : String(error));
  }
}

// ============================================================================
// EXAMPLE: Sepolia USDC → Columbus USDC
// ============================================================================

async function exampleSepoliaToColumbus() {
  console.log('\n=== Example: Ethereum Sepolia USDC → Columbus USDC ===\n');

  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  if (!PRIVATE_KEY) {
    console.error('Error: PRIVATE_KEY environment variable not set');
    process.exit(1);
  }

  const SOURCE_CHAIN_ID = 11155111; // Sepolia
  const DEST_CHAIN_ID = 501; // Columbus
  const TOKEN_IN = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'; // USDC on Sepolia
  const TOKEN_OUT = '0x55406F3eDC2DE6B1C5E6c8235699287551422E92'; // USDC.e on Columbus
  const AMOUNT = '1'; // 1 USDC
  const DECIMALS = 6; // USDC has 6 decimals

  const provider = new ethers.JsonRpcProvider(RPC_URLS.SEPOLIA);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const walletAddress = wallet.address;

  console.log(`Wallet: ${walletAddress}`);
  console.log(`\nTransfer Details:`);
  console.log(`  From: Ethereum Sepolia (11155111) to Columbus (501)`);
  console.log(`  Token: ${AMOUNT} USDC`);
  console.log(`  Recipient: ${walletAddress}`);

  try {
    const bridgeContract = new ethers.Contract(
      BRIDGE_ADDRESSES[SOURCE_CHAIN_ID],
      BRIDGE_ABI,
      wallet
    );

    // Check transfer allowed
    console.log('\n[1] Checking transfer...');
    const allowed = await bridgeContract.getAllowedTransfer(SOURCE_CHAIN_ID, DEST_CHAIN_ID, TOKEN_IN);
    console.log(`    ✓ Allowed: ${allowed[0]}`);

    if (!allowed[0]) {
      console.error('    ✗ Transfer not allowed!');
      return;
    }

    // Get fees
    console.log('\n[2] Getting fees...');
    const validatorFee = await bridgeContract.validator_fee();
    const validators = await bridgeContract.getValidators();
    const totalFee = validatorFee * BigInt(validators.length);

    console.log(`    ✓ Total fee: ${ethers.formatEther(totalFee)} ETH`);

    // Check balances
    console.log('\n[3] Checking balances...');
    const nativeBalance = await provider.getBalance(walletAddress);
    const erc20Contract = new ethers.Contract(TOKEN_IN, ERC20_ABI, wallet);
    const tokenBalance = await erc20Contract.balanceOf(walletAddress);

    console.log(`    ✓ ETH balance: ${ethers.formatEther(nativeBalance)}`);
    console.log(`    ✓ USDC balance: ${ethers.formatUnits(tokenBalance, DECIMALS)}`);

    // Approve token
    console.log('\n[4] Approving token...');
    const amountBN = ethers.parseUnits(AMOUNT, DECIMALS);
    const approveTx = await erc20Contract.approve(BRIDGE_ADDRESSES[SOURCE_CHAIN_ID], amountBN);
    await approveTx.wait();
    console.log(`    ✓ Approved`);

    // Execute transfer
    console.log('\n[5] Executing transfer...');
    const tx = await bridgeContract.initiateTransfer(
      walletAddress,
      amountBN,
      SOURCE_CHAIN_ID,
      DEST_CHAIN_ID,
      TOKEN_IN,
      TOKEN_OUT,
      { value: totalFee }
    );

    console.log(`    → Tx: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`    ✓ Confirmed`);

    console.log('\n✓ Transfer completed!');
  } catch (error) {
    console.error('\n✗ Transfer failed:');
    console.error(error instanceof Error ? error.message : String(error));
  }
}

// ============================================================================
// MAIN - Run Example
// ============================================================================

async function main() {
  const example = process.argv[2] || 'bnb';

  if (example === 'bnb') {
    await exampleBNBtoColumbus();
  } else if (example === 'usdc') {
    await exampleSepoliaToColumbus();
  } else {
    console.log('\nBridge Transfer Examples\n');
    console.log('Usage:');
    console.log('  export PRIVATE_KEY=0x...');
    console.log('  npx ts-node bridge-example.ts [example]\n');
    console.log('Examples:');
    console.log('  bnb   - BNB Testnet wCAM → Columbus CAM');
    console.log('  usdc  - Ethereum Sepolia USDC → Columbus USDC\n');
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
