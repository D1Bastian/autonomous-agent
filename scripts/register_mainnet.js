/**
 * register_mainnet.js
 * Registers "Clawed" on the official GOAT Network ERC-8004 Agent Registry (Mainnet).
 * 
 * Usage: node scripts/register_mainnet.js
 * Requires: PRIVATE_KEY set in .env
 */

import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

// --- Official GOAT Mainnet Config ---
const RPC_URL     = 'https://rpc.goat.network';
const CHAIN_ID    = 2345;
const REGISTRY    = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';
const AGENT_NAME  = 'Clawed';

// Minimal ERC-8004 ABI — only what we need
const ABI = [
  'function register(string name) external',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
];

async function main() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk || pk.includes('YOUR_PRIVATE_KEY')) {
    console.error('❌ PRIVATE_KEY not set in .env');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL, { chainId: CHAIN_ID, name: 'goat' });
  const wallet   = new ethers.Wallet(pk, provider);
  const registry = new ethers.Contract(REGISTRY, ABI, wallet);

  const balance = await provider.getBalance(wallet.address);
  console.log(`💼 Wallet: ${wallet.address}`);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} GOAT`);

  if (balance === 0n) {
    console.error('❌ Wallet has 0 GOAT. Fund it first via the gas request form.');
    process.exit(1);
  }

  console.log(`📝 Registering agent "${AGENT_NAME}" on ERC-8004 registry...`);

  const tx = await registry.register(AGENT_NAME);
  console.log(`⏳ Tx submitted: ${tx.hash}`);
  console.log(`🔗 Explorer: https://explorer.goat.network/tx/${tx.hash}`);

  const receipt = await tx.wait();
  console.log(`✅ Confirmed in block ${receipt.blockNumber}`);

  // Pull the minted token ID from the Transfer event
  const iface = new ethers.Interface(ABI);
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed && parsed.name === 'Transfer') {
        const tokenId = parsed.args.tokenId.toString();
        console.log(`\n🎉 Agent registered! Token ID (ERC-8004): ${tokenId}`);
        console.log(`🔍 Verify on: https://8004scan.io/agents?chain=2345`);
      }
    } catch (_) {}
  }
}

main().catch(e => { console.error(e); process.exit(1); });
