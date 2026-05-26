/**
 * update_metadata.js
 * Updates the ERC-8004 metadata for "Clawed" on GOAT Mainnet, linking its x402 settings.
 * 
 * Usage: node scripts/update_metadata.js
 */

import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

const RPC_URL     = 'https://rpc.goat.network';
const CHAIN_ID    = 2345;
const REGISTRY    = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';
const TOKEN_ID    = 37;

const ABI = [
  'function setAgentURI(uint256 agentId, string newURI) external',
  'function tokenURI(uint256) view returns (string)'
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
    console.error('❌ Wallet has 0 GOAT. Need gas to update metadata.');
    process.exit(1);
  }

  const metadata = {
    name: "Clawed",
    description: "Autonomous trading agent swarm on GOAT Network. Sells premium trading signals via x402 protocol.",
    url: "https://clawup.org",
    wallet: wallet.address,
    x402: {
      merchantId: "37",
      receiveType: "DIRECT",
      chainId: 2345,
      token: "GOAT",
      receivingAddress: wallet.address,
      callbackUrl: "http://localhost:3000/api/v1/alpha-signal"
    }
  };

  const uriString = JSON.stringify(metadata);
  console.log(`📝 Updating ERC-8004 Agent URI to:\n${JSON.stringify(metadata, null, 2)}`);

  const tx = await registry.setAgentURI(TOKEN_ID, uriString);
  console.log(`⏳ Tx submitted: ${tx.hash}`);
  console.log(`🔗 Explorer: https://explorer.goat.network/tx/${tx.hash}`);

  const receipt = await tx.wait();
  console.log(`✅ Confirmed in block ${receipt.blockNumber}`);
  console.log(`🎉 ERC-8004 agent metadata updated for Token ID ${TOKEN_ID}!`);
}

main().catch(e => { console.error(e); process.exit(1); });
