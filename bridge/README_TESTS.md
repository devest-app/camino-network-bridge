# Bridge Test Scripts

This directory contains comprehensive test scripts for the Camino Bridge with support for multiple transfer scenarios.

## Overview

Three test scripts are provided, each serving a different purpose:

| Script | Purpose | Use Case |
|--------|---------|----------|
| `bridge-test.ts` | Basic validation | Verify bridge configuration & transfer eligibility |
| `bridge-integration-test.ts` | Full integration testing | Complete transfer flow with optional execution |
| `bridge-example.ts` | Quick reference examples | Learn by example & quick transfers |

## Quick Start

### 1. Install Dependencies
```bash
npm install ethers
npm install -D typescript ts-node @types/node
```

### 2. Run Validation (No Gas Cost)
```bash
npx ts-node bridge/bridge-test.ts
```

### 3. Test Transfer Flow
```bash
# Validation mode (reads-only)
npx ts-node bridge/bridge-integration-test.ts

# With actual execution
export PRIVATE_KEY=0x<your-key>
export EXECUTE=true
npx ts-node bridge/bridge-integration-test.ts
```

### 4. Quick Transfer
```bash
export PRIVATE_KEY=0x<your-key>

# BNB → Columbus
npx ts-node bridge/bridge-example.ts bnb

# Sepolia → Columbus
npx ts-node bridge/bridge-example.ts usdc
```

## Test Scenarios

All scripts test the following transfer pairs:

### 1. BNB Smart Chain ↔ Columbus
- **Forward:** BNB Testnet (97) wCAM → Columbus (501) CAM
- **Reverse:** Columbus (501) CAM → BNB Testnet (97) wCAM
- **Contracts:**
  - Source: `0x7CA996573346794d6B5e4aAA624203e325cdE989` (BNB)
  - Source: `0xffDAf09685e8c42Ed8bcAdaA00fEbcecacC56C8c` (Columbus)

### 2. Ethereum Sepolia ↔ Columbus
- **Forward:** Ethereum Sepolia (11155111) USDC → Columbus (501) USDC.e
- **Reverse:** Columbus (501) USDC.e → Ethereum Sepolia (11155111) USDC
- **Contracts:**
  - Source: `0x7A7707bEe60b3904E6748b576F7d65819fb1B783` (Sepolia)
  - Source: `0xffDAf09685e8c42Ed8bcAdaA00fEbcecacC56C8c` (Columbus)

## Detailed Documentation

See [TEST_GUIDE.md](./TEST_GUIDE.md) for comprehensive documentation including:
- Detailed setup instructions
- Environment variable configuration
- Transfer flow explanation
- Common issues & solutions
- Balance monitoring
- Debugging tips

## Script Comparison

### `bridge-test.ts`
```bash
npx ts-node bridge/bridge-test.ts
```

**Output:**
- ✓ Transfer allowed status
- ✓ Validator fees
- ✓ Balance checks
- ✓ Token configuration
- ✓ Next steps

**No Requirements:** Doesn't need wallet/private key

---

### `bridge-integration-test.ts`
```bash
npx ts-node bridge/bridge-integration-test.ts
# OR with execution:
export PRIVATE_KEY=0x...
export EXECUTE=true
npx ts-node bridge/bridge-integration-test.ts
```

**Output:**
- ✓ Complete validation
- ✓ Transaction hashes (if executed)
- ✓ Detailed error messages
- ✓ All scenario results

**Requirements (for execution):** PRIVATE_KEY environment variable

---

### `bridge-example.ts`
```bash
export PRIVATE_KEY=0x...
npx ts-node bridge/bridge-example.ts bnb      # BNB example
npx ts-node bridge/bridge-example.ts usdc     # USDC example
npx ts-node bridge/bridge-example.ts          # Show usage
```

**Output:**
- ✓ Step-by-step execution logs
- ✓ Transaction confirmation
- ✓ Clear next steps

**Requirements:** PRIVATE_KEY environment variable

## Transfer Flow

### Validation Phase
1. Connect to source chain RPC
2. Check if transfer route is enabled
3. Get validator fees (can vary by chain)
4. Check wallet native balance
5. Check token balance (if ERC-20)
6. Check token allowance (if ERC-20)

### Execution Phase
1. Approve token (if ERC-20 and allowance too low)
2. Call `initiateTransfer()` on bridge contract
3. Wait for transaction confirmation
4. **Bridge validators** process the transfer
5. Tokens appear on destination chain

## Key Contract Functions

### `initiateTransfer()`
Initiates a cross-chain token transfer.

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

**Fee Calculation:**
```typescript
// Native token transfer
value = amount + (validator_fee * validator_count)

// ERC-20 token transfer
value = validator_fee * validator_count
```

### `getAllowedTransfer()`
Checks if a transfer route is enabled and gets configuration.

```solidity
function getAllowedTransfer(
    uint256 source_chain,
    uint256 destination_chain,
    address token_in
) public view returns (bool active, uint256 max_amount, address token_out)
```

## Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `PRIVATE_KEY` | Signer for transactions | `0xabc123...` |
| `EXECUTE` | Enable transfer execution | `true` |
| `TEST_WALLET` | Override wallet address | `0x123...` |

## Common Workflows

### Workflow 1: Verify Setup
```bash
npx ts-node bridge/bridge-test.ts
```
Takes ~5 seconds, no gas cost.

### Workflow 2: Test with Small Amount
```bash
export PRIVATE_KEY=0x<your-test-key>
npx ts-node bridge/bridge-integration-test.ts
# (Review validation output)

export EXECUTE=true
npx ts-node bridge/bridge-integration-test.ts
```
Takes ~30-60 seconds per transfer.

### Workflow 3: Execute Single Transfer
```bash
export PRIVATE_KEY=0x<your-key>
npx ts-node bridge/bridge-example.ts bnb
```
Takes ~30 seconds.

## Troubleshooting

### "Transfer not allowed on source chain"
The route may be disabled. Check with bridge operators.

### "Insufficient balance for fees"
Add more native tokens (ETH/BNB/CAM) to pay fees. Scripts show exact fee amounts.

### "Insufficient token allowance"
Scripts auto-approve tokens. Ensure approval tx confirms before transfer.

### "Bridge is locked"
The bridge may be under maintenance. Try again later.

### RPC Connection Failed
Check RPC URLs in script configuration. May need to update if providers change.

## Integration with Frontend

The bridge service (`bridge.service.ts`) uses the same contracts and functions:

```typescript
// From bridge-widget.component.ts
const result = await this.bridgeService.executeBridge({
  sourceNetwork: '0x61', // hex chain ID
  destinationNetwork: '0x1f5',
  amount: 1,
  tokenIn: '0x...',
  tokenOut: '0x...',
  recipient: wallet.address,
  tokenDecimals: 18
});
```

The test scripts validate the same contracts and logic.

## Support & Resources

- **Bridge Service:** [bridge.service.ts](./bridge.service.ts) - Frontend service implementation
- **Networks Config:** [networks.json](./networks.json) - Network details
- **Tokens Config:** [Tokens.json](./Tokens.json) - Token details
- **Widget Component:** [bridge-widget.component.ts](./bridge-widget.component.ts) - UI implementation

## Development

### Adding New Test Scenario

1. Add network to `NETWORKS` object
2. Add bridge contract address to `BRIDGE_CONTRACTS`
3. Add token configuration to `TOKENS`
4. Add scenario to `TEST_SCENARIOS` array

### Modifying Transfer Amount

In any script, change the `amount` field in scenario configuration:
```typescript
{
  name: 'Example Transfer',
  // ...
  amount: '10' // Change this
}
```

## Performance

- **Validation script:** ~5 seconds
- **Integration test (validation):** ~10 seconds
- **Integration test (with transfer):** ~30-60 seconds per transfer
- **Balance polling:** ~200+ seconds (depends on validator speed)

## Security Notes

⚠️ **IMPORTANT:**
- Never commit private keys to version control
- Use test/throwaway wallets for testing
- Verify contract addresses before execution
- Test with small amounts first
- Keep `PRIVATE_KEY` in `.env` file (not committed)
