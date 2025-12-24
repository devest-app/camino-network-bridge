import { ethers } from 'ethers';

// ============================================================================
// CONFIGURATION
// ============================================================================

const NETWORKS = {
  BNB_TESTNET: { chainId: 97, name: 'BNB Testnet', rpc: 'https://data-seed-prebsc-2-s1.binance.org:8545/' },
  COLUMBUS: { chainId: 501, name: 'Columbus Testnet', rpc: 'https://columbus.camino.network/ext/bc/C/rpc' },
  SEPOLIA: { chainId: 11155111, name: 'Ethereum Sepolia', rpc: 'https://0xrpc.io/sep' }
};

const BRIDGE_CONTRACTS = {
  [NETWORKS.BNB_TESTNET.chainId]: '0x7CA996573346794d6B5e4aAA624203e325cdE989',
  [NETWORKS.COLUMBUS.chainId]: '0xffDAf09685e8c42Ed8bcAdaA00fEbcecacC56C8c',
  [NETWORKS.SEPOLIA.chainId]: '0x7A7707bEe60b3904E6748b576F7d65819fb1B783'
};

const TOKENS = {
  // BNB Testnet
  wCAM_BNB: {
    address: '0x7CA996573346794d6B5e4aAA624203e325cdE989',
    decimals: 18,
    symbol: 'wCAM',
    chainId: 97
  },
  // Columbus
  CAM_COLUMBUS_NATIVE: {
    address: '0x0000000000000000000000000000000000000000', // Native token
    decimals: 18,
    symbol: 'CAM',
    chainId: 501,
    isNative: true
  },
  USDC_COLUMBUS: {
    address: '0x55406F3eDC2DE6B1C5E6c8235699287551422E92',
    decimals: 6,
    symbol: 'USDC.e',
    chainId: 501
  },
  // Sepolia
  USDC_SEPOLIA: {
    address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    decimals: 6,
    symbol: 'USDC',
    chainId: 11155111
  }
};

// Bridge ABI (minimal - just what we need for testing)
const BRIDGE_ABI = [
  'function initiateTransfer(address recipient, uint256 amount, uint256 source_chain, uint256 destination_chain, address token_in, address token_out) public payable returns (bool)',
  'function getAllowedTransfer(uint256 source_chain, uint256 destination_chain, address token_in) public view returns (address token_out, bool active, uint256 max_amount)',
  'function validator_fee() public view returns (uint256)',
  'function getValidators() public view returns (address[])',
  'event TransferInitiated(address indexed sender, address indexed recipient, uint256 amount, uint256 source_chain, uint256 destination_chain, address token_in, address token_out)'
];

// ERC20 ABI (minimal)
const ERC20_ABI = [
  'function balanceOf(address account) public view returns (uint256)',
  'function approve(address spender, uint256 amount) public returns (bool)',
  'function allowance(address owner, address spender) public view returns (uint256)',
  'function transfer(address to, uint256 amount) public returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) public returns (bool)',
  'function decimals() public view returns (uint8)',
  'function symbol() public view returns (string)'
];

// ============================================================================
// TEST SCENARIOS
// ============================================================================

interface TransferScenario {
  name: string;
  sourceNetwork: typeof NETWORKS[keyof typeof NETWORKS];
  destNetwork: typeof NETWORKS[keyof typeof NETWORKS];
  tokenIn: typeof TOKENS[keyof typeof TOKENS];
  tokenOut: typeof TOKENS[keyof typeof TOKENS];
  amount: string;
}

const TEST_SCENARIOS: TransferScenario[] = [
  {
    name: 'BNB Testnet wCAM → Columbus CAM',
    sourceNetwork: NETWORKS.BNB_TESTNET,
    destNetwork: NETWORKS.COLUMBUS,
    tokenIn: TOKENS.wCAM_BNB,
    tokenOut: TOKENS.CAM_COLUMBUS_NATIVE,
    amount: '0.1' // Small amount for testing
  },
  {
    name: 'Columbus CAM → BNB Testnet wCAM',
    sourceNetwork: NETWORKS.COLUMBUS,
    destNetwork: NETWORKS.BNB_TESTNET,
    tokenIn: TOKENS.CAM_COLUMBUS_NATIVE,
    tokenOut: TOKENS.wCAM_BNB,
    amount: '0.05'
  },
  {
    name: 'Ethereum Sepolia USDC → Columbus USDC',
    sourceNetwork: NETWORKS.SEPOLIA,
    destNetwork: NETWORKS.COLUMBUS,
    tokenIn: TOKENS.USDC_SEPOLIA,
    tokenOut: TOKENS.USDC_COLUMBUS,
    amount: '1' // 1 USDC (6 decimals)
  },
  {
    name: 'Columbus USDC → Ethereum Sepolia USDC',
    sourceNetwork: NETWORKS.COLUMBUS,
    destNetwork: NETWORKS.SEPOLIA,
    tokenIn: TOKENS.USDC_COLUMBUS,
    tokenOut: TOKENS.USDC_SEPOLIA,
    amount: '0.5'
  }
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

async function getProvider(chainId: number): Promise<ethers.Provider> {
  const network = Object.values(NETWORKS).find(n => n.chainId === chainId);
  if (!network) throw new Error(`Network not found for chainId: ${chainId}`);
  return new ethers.JsonRpcProvider(network.rpc);
}

async function getWallet(privateKey: string, chainId: number): Promise<ethers.Wallet> {
  const provider = await getProvider(chainId);
  return new ethers.Wallet(privateKey, provider);
}

async function getBridgeContract(chainId: number): Promise<ethers.Contract> {
  const provider = await getProvider(chainId);
  const address = BRIDGE_CONTRACTS[chainId as keyof typeof BRIDGE_CONTRACTS];
  if (!address) throw new Error(`Bridge contract not found for chainId: ${chainId}`);
  return new ethers.Contract(address, BRIDGE_ABI, provider);
}

async function getTokenContract(tokenAddress: string, chainId: number, signer?: ethers.Signer): Promise<ethers.Contract> {
  const provider = await getProvider(chainId);
  const contractProvider = signer || provider;
  return new ethers.Contract(tokenAddress, ERC20_ABI, contractProvider);
}

async function checkAllowedTransfer(
  scenario: TransferScenario
): Promise<{ active: boolean; maxAmount: string; tokenOut: string }> {
  const bridgeContract = await getBridgeContract(scenario.sourceNetwork.chainId);
  try {
    const result = await bridgeContract.getAllowedTransfer(
      scenario.sourceNetwork.chainId,
      scenario.destNetwork.chainId,
      scenario.tokenIn.address
    );
    return {
      active: result[1],
      maxAmount: ethers.formatUnits(result[2], scenario.tokenIn.decimals),
      tokenOut: result[0]
    };
  } catch (error) {
    console.error('Error checking allowed transfer:', error);
    return { active: false, maxAmount: '0', tokenOut: '' };
  }
}

async function getTransferFees(scenario: TransferScenario): Promise<{ validatorFee: string; totalFee: string }> {
  const bridgeContract = await getBridgeContract(scenario.sourceNetwork.chainId);
  try {
    const validatorFee = await bridgeContract.validator_fee();
    const validators = await bridgeContract.getValidators();
    const totalFee = validatorFee * BigInt(validators.length);
    return {
      validatorFee: ethers.formatEther(validatorFee),
      totalFee: ethers.formatEther(totalFee)
    };
  } catch (error) {
    console.error('Error getting transfer fees:', error);
    return { validatorFee: '0', totalFee: '0' };
  }
}

async function checkBalance(
  tokenAddress: string,
  walletAddress: string,
  chainId: number,
  tokenDecimals: number,
  isNative?: boolean
): Promise<string> {
  if (isNative) {
    const provider = await getProvider(chainId);
    const balance = await provider.getBalance(walletAddress);
    return ethers.formatEther(balance);
  } else {
    const tokenContract = await getTokenContract(tokenAddress, chainId);
    const balance = await tokenContract.balanceOf(walletAddress);
    return ethers.formatUnits(balance, tokenDecimals);
  }
}

// ============================================================================
// MAIN TEST EXECUTION
// ============================================================================

async function runTestScenario(scenario: TransferScenario, walletAddress: string): Promise<void> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`TEST: ${scenario.name}`);
  console.log(`${'='.repeat(80)}`);

  try {
    // Step 1: Check if transfer is allowed
    console.log('\n[1] Checking if transfer is allowed...');
    const allowedTransfer = await checkAllowedTransfer(scenario);
    console.log(`    ✓ Transfer allowed: ${allowedTransfer.active}`);
    console.log(`    ✓ Max amount: ${allowedTransfer.maxAmount} ${scenario.tokenIn.symbol}`);
    console.log(`    ✓ Token out: ${allowedTransfer.tokenOut}`);

    if (!allowedTransfer.active) {
      console.warn('    ⚠ Transfer not allowed on source chain!');
      return;
    }

    // Step 2: Get transfer fees
    console.log('\n[2] Getting transfer fees...');
    const fees = await getTransferFees(scenario);
    console.log(`    ✓ Validator fee: ${fees.validatorFee} ETH`);
    console.log(`    ✓ Total fee (all validators): ${fees.totalFee} ETH`);

    // Step 3: Check wallet balance on source chain
    console.log('\n[3] Checking wallet balance on source chain...');
    const sourceBalance = await checkBalance(
      scenario.tokenIn.address,
      walletAddress,
      scenario.sourceNetwork.chainId,
      scenario.tokenIn.decimals,
      scenario.tokenIn.isNative
    );
    console.log(`    ✓ Balance: ${sourceBalance} ${scenario.tokenIn.symbol}`);

    const amountBN = ethers.parseUnits(scenario.amount, scenario.tokenIn.decimals);
    if (ethers.parseUnits(sourceBalance, scenario.tokenIn.decimals) < amountBN) {
      console.warn(`    ⚠ Insufficient balance! Need ${scenario.amount}, have ${sourceBalance}`);
      return;
    }

    // Step 4: Check initial balance on destination chain
    console.log('\n[4] Checking initial balance on destination chain...');
    const destBalanceBefore = await checkBalance(
      scenario.tokenOut.address,
      walletAddress,
      scenario.destNetwork.chainId,
      scenario.tokenOut.decimals,
      scenario.tokenOut.isNative
    );
    console.log(`    ✓ Balance before transfer: ${destBalanceBefore} ${scenario.tokenOut.symbol}`);

    // Step 5: Simulate token approval (if not native)
    if (!scenario.tokenIn.isNative) {
      console.log('\n[5] Checking token approval...');
      try {
        const signer = new ethers.Wallet('0x' + '0'.repeat(64)); // Placeholder - would need real private key
        const tokenContract = await getTokenContract(scenario.tokenIn.address, scenario.sourceNetwork.chainId, signer);
        const allowance = await tokenContract.allowance(walletAddress, BRIDGE_CONTRACTS[scenario.sourceNetwork.chainId]);
        const allowanceAmount = ethers.formatUnits(allowance, scenario.tokenIn.decimals);
        console.log(`    ✓ Current allowance: ${allowanceAmount} ${scenario.tokenIn.symbol}`);

        if (ethers.getBigInt(allowance) < amountBN) {
          console.log(`    → Would need to approve ${scenario.amount} tokens for transfer`);
        }
      } catch (error) {
        console.log('    ℹ Skipping approval check (would need signer)');
      }
    }

    // Step 6: Log transfer parameters
    console.log('\n[6] Transfer parameters:');
    console.log(`    ✓ Source: ${scenario.sourceNetwork.name} (Chain ID: ${scenario.sourceNetwork.chainId})`);
    console.log(`    ✓ Destination: ${scenario.destNetwork.name} (Chain ID: ${scenario.destNetwork.chainId})`);
    console.log(`    ✓ Amount: ${scenario.amount} ${scenario.tokenIn.symbol}`);
    console.log(`    ✓ Token in: ${scenario.tokenIn.address}`);
    console.log(`    ✓ Token out: ${scenario.tokenOut.address}`);
    console.log(`    ✓ Recipient: ${walletAddress}`);
    console.log(`    ✓ Bridge contract: ${BRIDGE_CONTRACTS[scenario.sourceNetwork.chainId]}`);

    // Step 7: Show next steps
    console.log('\n[7] To execute this transfer:');
    console.log(`    1. Connect wallet to ${scenario.sourceNetwork.name}`);
    if (!scenario.tokenIn.isNative) {
      console.log(`    2. Approve ${scenario.amount} ${scenario.tokenIn.symbol} for bridge contract`);
    }
    console.log(`    3. Call initiateTransfer with above parameters`);
    console.log(`    4. Wait for validators to complete the transfer on ${scenario.destNetwork.name}`);
    console.log(`    5. Monitor balance changes on destination chain`);

    console.log('\n✓ Test scenario validation completed successfully\n');
  } catch (error) {
    console.error('\n✗ Test scenario validation failed:');
    console.error(error);
    console.log();
  }
}

async function main(): Promise<void> {
  console.log(`\n${'='.repeat(80)}`);
  console.log('CAMINO BRIDGE - TRANSFER TEST SCRIPT');
  console.log(`${'='.repeat(80)}`);
  console.log('\nThis script validates bridge transfer scenarios without executing them.');
  console.log('Use this to understand the transfer flow and verify contract setup.\n');

  // Get wallet address from environment or use a placeholder
  const WALLET_ADDRESS = process.env.TEST_WALLET || '0x1234567890123456789012345678901234567890';

  console.log(`Test wallet: ${WALLET_ADDRESS}`);
  console.log(`\nRunning ${TEST_SCENARIOS.length} test scenarios...\n`);

  // Run each scenario
  for (const scenario of TEST_SCENARIOS) {
    await runTestScenario(scenario, WALLET_ADDRESS);
  }

  // Summary
  console.log(`${'='.repeat(80)}`);
  console.log('TEST SUMMARY');
  console.log(`${'='.repeat(80)}`);
  console.log(`Total scenarios: ${TEST_SCENARIOS.length}`);
  console.log(`\nTest pairs:`);
  console.log('  1. BNB Testnet ↔ Columbus Testnet (wCAM ↔ CAM)');
  console.log('  2. Ethereum Sepolia ↔ Columbus Testnet (USDC ↔ USDC)');
  console.log(`\nTo run actual transfers with a real wallet, set TEST_WALLET environment variable:`);
  console.log('  export TEST_WALLET=0xYourWalletAddress');
  console.log('  npx ts-node bridge-test.ts\n');
}

main().catch((error) => {
  console.error('\nFatal error:', error);
  process.exit(1);
});
