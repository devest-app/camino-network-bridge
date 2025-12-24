/**
 * Bridge Integration Test Script
 *
 * This script tests the complete bridge transfer flow using ethers.js
 * It simulates the BridgeService logic for actual contract interactions
 *
 * Usage:
 *   PRIVATE_KEY=0x... npx ts-node bridge-integration-test.ts
 *
 * Scenarios:
 * 1. BNB Testnet (97) wCAM → Columbus (501) CAM
 * 2. Columbus (501) CAM → BNB Testnet (97) wCAM
 * 3. Ethereum Sepolia (11155111) USDC → Columbus (501) USDC
 * 4. Columbus (501) USDC → Ethereum Sepolia (11155111) USDC
 */







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

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// Token configurations
const TOKENS = {
  wCAM_BNB: {
    address: '0x7CA996573346794d6B5e4aAA624203e325cdE989',
    decimals: 18,
    symbol: 'wCAM',
    chainId: 97
  },
  CAM_COLUMBUS: {
    address: ZERO_ADDRESS, // Native CAM
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
  USDC_SEPOLIA: {
    address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    decimals: 6,
    symbol: 'USDC',
    chainId: 11155111
  }
};

// Bridge ABI
const BRIDGE_ABI = [
  'function initiateTransfer(address recipient, uint256 amount, uint256 source_chain, uint256 destination_chain, address token_in, address token_out) public payable returns (bool)',
  'function getAllowedTransfer(uint256 source_chain, uint256 destination_chain, address token_in) public view returns (address token_out, bool active, uint256 max_amount)',
  'function validator_fee() public view returns (uint256)',
  'function getValidators() public view returns (address[])',
  'event TransferInitiated(address indexed sender, address indexed recipient, uint256 amount, uint256 source_chain, uint256 destination_chain, address token_in, address token_out)'
];

// ERC20 ABI
const ERC20_ABI = [
  'function balanceOf(address account) public view returns (uint256)',
  'function approve(address spender, uint256 amount) public returns (bool)',
  'function allowance(address owner, address spender) public view returns (uint256)',
  'function transfer(address to, uint256 amount) public returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) public returns (bool)',
  'function decimals() public view returns (uint8)',
  'function symbol() public view returns (string)',
  'function balanceOf(address account) external view returns (uint256)'
];

// ============================================================================
// TYPES
// ============================================================================

interface TransferScenario {
  name: string;
  sourceChainId: number;
  destChainId: number;
  tokenIn: typeof TOKENS[keyof typeof TOKENS];
  tokenOut: typeof TOKENS[keyof typeof TOKENS];
  amount: string;
  skipTransfer?: boolean; // Skip actual transfer, just validate
}

interface TransferResult {
  success: boolean;
  sourceTxHash?: string;
  destinationTxHash?: string;
  error?: string;
  message?: string;
}

// ============================================================================
// TRANSFER SCENARIOS
// ============================================================================

const TEST_SCENARIOS: TransferScenario[] = [
  {
    name: 'BNB Testnet wCAM → Columbus CAM',
    sourceChainId: 97,
    destChainId: 501,
    tokenIn: TOKENS.wCAM_BNB,
    tokenOut: TOKENS.CAM_COLUMBUS,
    amount: '0.1',
    skipTransfer: true // Skip to avoid requiring actual tokens
  },
  {
    name: 'Columbus CAM → BNB Testnet wCAM',
    sourceChainId: 501,
    destChainId: 97,
    tokenIn: TOKENS.CAM_COLUMBUS,
    tokenOut: TOKENS.wCAM_BNB,
    amount: '0.05',
    skipTransfer: true
  },
  {
    name: 'Ethereum Sepolia USDC → Columbus USDC',
    sourceChainId: 11155111,
    destChainId: 501,
    tokenIn: TOKENS.USDC_SEPOLIA,
    tokenOut: TOKENS.USDC_COLUMBUS,
    amount: '1',
    skipTransfer: true
  },
  {
    name: 'Columbus USDC → Ethereum Sepolia USDC',
    sourceChainId: 501,
    destChainId: 11155111,
    tokenIn: TOKENS.USDC_COLUMBUS,
    tokenOut: TOKENS.USDC_SEPOLIA,
    amount: '0.5',
    skipTransfer: true
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

async function getSigner(privateKey: string, chainId: number): Promise<ethers.Wallet> {
  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable not set');
  }
  const provider = await getProvider(chainId);
  return new ethers.Wallet(privateKey, provider);
}

function getBridgeAddress(chainId: number): string {
  const address = BRIDGE_CONTRACTS[chainId as keyof typeof BRIDGE_CONTRACTS];
  if (!address) throw new Error(`Bridge contract not found for chainId: ${chainId}`);
  return address;
}

async function getBridgeContract(chainId: number, signer?: ethers.Signer): Promise<ethers.Contract> {
  const provider = await getProvider(chainId);
  const contractProvider = signer || provider;
  return new ethers.Contract(getBridgeAddress(chainId), BRIDGE_ABI, contractProvider);
}

async function getTokenContract(
  tokenAddress: string,
  chainId: number,
  signer?: ethers.Signer
): Promise<ethers.Contract> {
  const provider = await getProvider(chainId);
  const contractProvider = signer || provider;
  return new ethers.Contract(tokenAddress, ERC20_ABI, contractProvider);
}

// ============================================================================
// BRIDGE OPERATIONS
// ============================================================================

async function validateTransfer(
  scenario: TransferScenario,
  walletAddress: string
): Promise<{ valid: boolean; issues: string[] }> {
  const issues: string[] = [];

  try {
    // 1. Check if transfer is allowed on source
    const sourceBridgeContract = await getBridgeContract(scenario.sourceChainId);
    const allowed = await sourceBridgeContract.getAllowedTransfer(
      scenario.sourceChainId,
      scenario.destChainId,
      scenario.tokenIn.address
    );

    if (!allowed[1]) {
      issues.push('Transfer not allowed on source chain');
    }

    const maxAmount = ethers.formatUnits(allowed[2], scenario.tokenIn.decimals);
    if (parseFloat(scenario.amount) > parseFloat(maxAmount)) {
      issues.push(`Amount exceeds max allowed: ${maxAmount} ${scenario.tokenIn.symbol}`);
    }

    // 2. Check validator fee can be covered
    const validatorFee = await sourceBridgeContract.validator_fee();
    const validators = await sourceBridgeContract.getValidators();
    const totalFee = validatorFee * BigInt(validators.length);

    const nativeBalance = await (await getProvider(scenario.sourceChainId)).getBalance(walletAddress);
    const totalFeeInEth = parseFloat(ethers.formatEther(totalFee));
    const nativeBalanceInEth = parseFloat(ethers.formatEther(nativeBalance));

    if (nativeBalanceInEth < totalFeeInEth) {
      issues.push(
        `Insufficient native token for fees: need ${totalFeeInEth} ETH, have ${nativeBalanceInEth} ETH`
      );
    }

    // 3. Check token balance (if not native)
    if (!scenario.tokenIn.isNative) {
      const tokenContract = await getTokenContract(scenario.tokenIn.address, scenario.sourceChainId);
      const balance = await tokenContract.balanceOf(walletAddress);
      const balanceFormatted = ethers.formatUnits(balance, scenario.tokenIn.decimals);

      if (parseFloat(balanceFormatted) < parseFloat(scenario.amount)) {
        issues.push(
          `Insufficient token balance: need ${scenario.amount} ${scenario.tokenIn.symbol}, have ${balanceFormatted}`
        );
      }

      // Check allowance
      const allowance = await tokenContract.allowance(walletAddress, getBridgeAddress(scenario.sourceChainId));
      const allowanceFormatted = ethers.formatUnits(allowance, scenario.tokenIn.decimals);

      if (parseFloat(allowanceFormatted) < parseFloat(scenario.amount)) {
        issues.push(
          `Insufficient allowance: need ${scenario.amount} ${scenario.tokenIn.symbol}, have ${allowanceFormatted}`
        );
      }
    }

    return { valid: issues.length === 0, issues };
  } catch (error) {
    return {
      valid: false,
      issues: [`Validation error: ${error instanceof Error ? error.message : String(error)}`]
    };
  }
}

async function executeTransfer(
  scenario: TransferScenario,
  privateKey: string,
  recipientAddress: string
): Promise<TransferResult> {
  try {
    const signer = await getSigner(privateKey, scenario.sourceChainId);
    const walletAddress = signer.address;

    // Validate first
    const validation = await validateTransfer(scenario, walletAddress);
    if (!validation.valid) {
      return {
        success: false,
        error: 'Validation failed',
        message: validation.issues.join('; ')
      };
    }

    // Get bridge contract with signer
    const bridgeContract = await getBridgeContract(scenario.sourceChainId, signer);

    // Approve token if needed
    if (!scenario.tokenIn.isNative) {
      const tokenContract = await getTokenContract(scenario.tokenIn.address, scenario.sourceChainId, signer);
      const amount = ethers.parseUnits(scenario.amount, scenario.tokenIn.decimals);

      const allowance = await tokenContract.allowance(walletAddress, getBridgeAddress(scenario.sourceChainId));
      if (allowance < amount) {
        console.log('  → Approving token...');
        const approveTx = await tokenContract.approve(getBridgeAddress(scenario.sourceChainId), amount);
        await approveTx.wait();
        console.log(`  ✓ Approval confirmed`);
      }
    }

    // Execute transfer
    const amount = ethers.parseUnits(scenario.amount, scenario.tokenIn.decimals);
    const validatorFee = await bridgeContract.validator_fee();
    const validators = await bridgeContract.getValidators();
    const totalFee = validatorFee * BigInt(validators.length);

    const txOptions: ethers.Overrides = {
      value: scenario.tokenIn.isNative ? amount + totalFee : totalFee
    };

    console.log('  → Executing transfer...');
    const tx = await bridgeContract.initiateTransfer(
      recipientAddress,
      amount,
      scenario.sourceChainId,
      scenario.destChainId,
      scenario.tokenIn.address,
      scenario.tokenOut.address,
      txOptions
    );

    console.log(`  ✓ Transaction sent: ${tx.hash}`);
    const receipt = await tx.wait();

    if (!receipt) {
      return {
        success: false,
        sourceTxHash: tx.hash,
        error: 'Transaction failed to confirm'
      };
    }

    return {
      success: true,
      sourceTxHash: receipt.hash,
      message: `Transfer initiated successfully. Tx: ${receipt.hash}`
    };
  } catch (error) {
    return {
      success: false,
      error: 'Transfer execution failed',
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

// ============================================================================
// REPORTING & DISPLAY
// ============================================================================

async function printScenarioValidation(scenario: TransferScenario, walletAddress: string): Promise<void> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`SCENARIO: ${scenario.name}`);
  console.log(`${'='.repeat(80)}`);
  console.log(`\nFrom: ${scenario.sourceChainId} (${Object.values(NETWORKS).find(n => n.chainId === scenario.sourceChainId)?.name})`);
  console.log(`To:   ${scenario.destChainId} (${Object.values(NETWORKS).find(n => n.chainId === scenario.destChainId)?.name})`);
  console.log(`\nToken In:  ${scenario.amount} ${scenario.tokenIn.symbol} (${scenario.tokenIn.address})`);
  console.log(`Token Out: ${scenario.tokenOut.symbol} (${scenario.tokenOut.address})`);
  console.log(`Wallet:    ${walletAddress}`);

  const validation = await validateTransfer(scenario, walletAddress);

  if (validation.valid) {
    console.log(`\n✓ Transfer validation PASSED`);
  } else {
    console.log(`\n✗ Transfer validation FAILED:`);
    validation.issues.forEach(issue => {
      console.log(`  • ${issue}`);
    });
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  console.log(`${'='.repeat(80)}`);
  console.log('BRIDGE INTEGRATION TEST');
  console.log(`${'='.repeat(80)}`);

  const privateKey = process.env.PRIVATE_KEY;
  const executeTransfers = process.env.EXECUTE === 'true';

  if (!privateKey) {
    console.log('\n⚠ PRIVATE_KEY not set. Running in validation-only mode.\n');
    console.log('To execute actual transfers, set:');
    console.log('  export PRIVATE_KEY=0x...');
    console.log('  export EXECUTE=true');
    console.log('  npx ts-node bridge-integration-test.ts\n');
  } else if (!executeTransfers) {
    console.log('\n⚠ EXECUTE not set to "true". Running in validation-only mode.\n');
    console.log('To execute transfers, set:');
    console.log('  export EXECUTE=true\n');
  }

  let signer: ethers.Wallet | undefined;
  let walletAddress = '0x1234567890123456789012345678901234567890';

  try {
    if (privateKey) {
      // Use any chain to get wallet address
      signer = await getSigner(privateKey, 501);
      walletAddress = signer.address;
      console.log(`Connected wallet: ${walletAddress}\n`);
    }
  } catch (error) {
    console.log(`Setup warning: ${error instanceof Error ? error.message : String(error)}\n`);
  }

  // Run validation for all scenarios
  console.log(`Running ${TEST_SCENARIOS.length} test scenarios...\n`);

  for (const scenario of TEST_SCENARIOS) {
    await printScenarioValidation(scenario, walletAddress);

    // Execute if enabled and not marked to skip
    if (executeTransfers && !scenario.skipTransfer && signer) {
      console.log(`\n→ Executing transfer...`);
      const result = await executeTransfer(scenario, privateKey!, walletAddress);

      if (result.success) {
        console.log(`✓ ${result.message}`);
      } else {
        console.log(`✗ ${result.error}`);
        if (result.message) {
          console.log(`  Details: ${result.message}`);
        }
      }
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('SUMMARY');
  console.log(`${'='.repeat(80)}`);
  console.log(`\nTest Pairs:`);
  console.log('  1. BNB Testnet (97) ↔ Columbus (501) - wCAM ↔ CAM');
  console.log('  2. Ethereum Sepolia (11155111) ↔ Columbus (501) - USDC ↔ USDC\n');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
