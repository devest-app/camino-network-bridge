# Bridge Testing Guide

This guide explains how to test the Camino Bridge functionality using the provided test scripts.

## Test Scripts

### 1. `bridge-test.ts` - Basic Validation Script

**Purpose:** Validates bridge transfer scenarios without executing transactions.

**Use Cases:**
- Verify bridge contract configuration
- Check if transfers are allowed between chains
- Validate token configurations
- Understand transfer flow without spending gas

**Running:**
```bash
npx ts-node bridge/bridge-test.ts
```

**Features:**
- ✓ Checks if transfers are allowed on source chain
- ✓ Verifies validator fees
- ✓ Checks wallet balances on both chains
- ✓ Validates token configurations
- ✓ Shows transfer parameters

### 2. `bridge-integration-test.ts` - Full Integration Test

**Purpose:** Complete end-to-end testing with optional transaction execution.

**Use Cases:**
- Validate all prerequisites before executing transfers
- Execute actual bridge transfers
- Test multiple transfer scenarios
- Debug transfer failures

**Running (Validation Only):**
```bash
npx ts-node bridge/bridge-integration-test.ts
```

**Running (Execute Transfers):**
```bash
export PRIVATE_KEY=0x<your-private-key>
export EXECUTE=true
npx ts-node bridge/bridge-integration-test.ts
```

**Features:**
- ✓ Complete validation before transfer
- ✓ Automatic token approval handling
- ✓ Transaction execution with confirmation
- ✓ Error handling and detailed reporting
- ✓ Balance checking across chains

## Test Scenarios

The test scripts validate 4 key transfer scenarios:

### Scenario 1: BNB Testnet → Columbus
- **Source:** BNB Smart Chain Testnet (Chain ID: 97)
- **Destination:** Columbus Testnet (Chain ID: 501)
- **Token In:** wCAM (0x7CA996573346794d6B5e4aAA624203e325cdE989)
- **Token Out:** CAM (Native)
- **Bridge Contract:** 0x7CA996573346794d6B5e4aAA624203e325cdE989

### Scenario 2: Columbus → BNB Testnet
- **Source:** Columbus Testnet (Chain ID: 501)
- **Destination:** BNB Smart Chain Testnet (Chain ID: 97)
- **Token In:** CAM (Native)
- **Token Out:** wCAM (0x7CA996573346794d6B5e4aAA624203e325cdE989)
- **Bridge Contract:** 0xffDAf09685e8c42Ed8bcAdaA00fEbcecacC56C8c

### Scenario 3: Ethereum Sepolia → Columbus
- **Source:** Ethereum Sepolia (Chain ID: 11155111)
- **Destination:** Columbus Testnet (Chain ID: 501)
- **Token In:** USDC (0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238)
- **Token Out:** USDC.e (0x55406F3eDC2DE6B1C5E6c8235699287551422E92)
- **Bridge Contract:** 0x7A7707bEe60b3904E6748b576F7d65819fb1B783

### Scenario 4: Columbus → Ethereum Sepolia
- **Source:** Columbus Testnet (Chain ID: 501)
- **Destination:** Ethereum Sepolia (Chain ID: 11155111)
- **Token In:** USDC.e (0x55406F3eDC2DE6B1C5E6c8235699287551422E92)
- **Token Out:** USDC (0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238)
- **Bridge Contract:** 0xffDAf09685e8c42Ed8bcAdaA00fEbcecacC56C8c

## Setup Requirements

### Install Dependencies

```bash
npm install ethers
npm install -D typescript ts-node @types/node
```

### Environment Variables

For executing transfers, set the following environment variables:

```bash
# Your private key (without 0x prefix, or include it - both work)
export PRIVATE_KEY=0x<your-private-key>

# Set to 'true' to execute actual transfers (otherwise validation only)
export EXECUTE=true

# Optional: specify test wallet address
export TEST_WALLET=0x<wallet-address>
```

## Transfer Flow

### Without Execution (Validation Mode)

1. **Connect to source chain RPC**
2. **Check if transfer is allowed** via `getAllowedTransfer()`
3. **Get validator fees** via `validator_fee()` and `getValidators()`
4. **Check wallet balance** on source chain
5. **Check token allowance** (for ERC-20 tokens)
6. **Display transfer parameters** and next steps

### With Execution

1. **All validation steps** (as above)
2. **Approve tokens** (if ERC-20, via `approve()`)
3. **Execute transfer** via `initiateTransfer()`
4. **Wait for confirmation**
5. **Display transaction hash**
6. **Monitor destination** for balance changes (manual for now)

## Bridge Contract Functions

### Key Functions Used

#### `initiateTransfer()`
```solidity
function initiateTransfer(
    address recipient,
    uint256 amount,
    uint256 source_chain,
    uint256 destination_chain,
    address token_in,
    address token_out
) public payable returns (bool)
```

**Parameters:**
- `recipient`: Wallet address receiving tokens on destination chain
- `amount`: Number of tokens to transfer (in smallest unit, e.g., wei for 18-decimal tokens)
- `source_chain`: Chain ID of source network
- `destination_chain`: Chain ID of destination network
- `token_in`: Token address on source chain (0x0000... for native)
- `token_out`: Token address on destination chain

**Fee Requirements:**
- For native tokens: `value = amount + (validator_fee * validator_count)`
- For ERC-20 tokens: `value = validator_fee * validator_count`

#### `getAllowedTransfer()`
```solidity
function getAllowedTransfer(
    uint256 source_chain,
    uint256 destination_chain,
    address token_in
) public view returns (bool active, uint256 max_amount, address token_out)
```

**Returns:**
- `active`: Whether transfer route is enabled
- `max_amount`: Maximum transferable amount
- `token_out`: Destination token address

## Common Issues & Solutions

### Issue: "Transfer not allowed on source chain"
**Solution:** The transfer route may not be configured. Contact bridge operators to enable the route.

### Issue: "Insufficient balance for fees"
**Solution:** Ensure you have enough native tokens (ETH/BNB/CAM) for validator fees. The script will show required fees.

### Issue: "Insufficient token allowance"
**Solution:** The token approval will be handled automatically. Ensure transaction confirms before checking.

### Issue: "Bridge is locked"
**Solution:** The bridge may be under maintenance. Try again later or contact operators.

## Balance Monitoring After Transfer

After executing `initiateTransfer()`, the tokens:

1. **Are locked** on the source chain
2. **Transfer validators** process the transfer
3. **Balance updates** on destination chain after validation

**Monitoring:**
```bash
# Check balance on destination chain
npx ts-node -e "
const { ethers } = require('ethers');
const provider = new ethers.JsonRpcProvider('destination-rpc-url');
const balance = await provider.getBalance('0xYourAddress');
console.log(ethers.formatEther(balance));
"
```

## Testing Checklist

- [ ] Install dependencies
- [ ] Run validation script successfully: `npx ts-node bridge/bridge-test.ts`
- [ ] Verify all 4 scenarios pass validation
- [ ] Get testnet tokens for one scenario
- [ ] Set PRIVATE_KEY environment variable
- [ ] Run integration test in validation mode
- [ ] Execute one transfer with `EXECUTE=true`
- [ ] Monitor destination chain for token arrival
- [ ] Verify token amounts are correct
- [ ] Check explorer links for transaction details

## Debugging

### Enable Verbose Logging

Add this at the top of test scripts:
```typescript
ethers.setLogLevel('debug');
```

### Check Contract Configuration

Verify bridge addresses in `BRIDGE_CONTRACTS` object match your deployment.

### Test RPC Connectivity

```bash
npx ts-node -e "
const { ethers } = require('ethers');
const providers = {
  97: new ethers.JsonRpcProvider('https://data-seed-prebsc-2-s1.binance.org:8545/'),
  501: new ethers.JsonRpcProvider('https://columbus.camino.network/ext/bc/C/rpc'),
  11155111: new ethers.JsonRpcProvider('https://0xrpc.io/sep')
};

for (const [chainId, provider] of Object.entries(providers)) {
  provider.getBlockNumber().then(block => console.log('Chain', chainId, '- Block:', block));
}
"
```
