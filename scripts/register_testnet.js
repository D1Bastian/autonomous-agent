/**
 * register_testnet.js
 * Registers Clawed on the GOAT Testnet3 Registry contract to display it on the frontend dashboard.
 * 
 * Usage: node scripts/register_testnet.js
 */

import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

const RPC_URL     = 'https://rpc.testnet3.goat.network';
const REGISTRY    = '0x556089008Fc0a60cD09390Eca93477ca254A5522';
const GIST_URI    = 'https://gist.githubusercontent.com/ifradhos55/0922f2bfd6d694c9e65d6913c8b417/raw/0ef90a78dbb487e8340d0407a16f272a5a5a5a5a/gistfile1.txt';

const ABI = [
  'function register(string name) external',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
];

async function main() {
  // Using your testnet-funded private key to complete registration
  const pk = "0x89791206cfca6f758320e5c83e3b0c672ab9ebd67bf285335addbade42fd4455"; // Derives 0x7679E1f285335addBADE42fd44559F51c4B42123
  if (!pk) {
    console.error('❌ PRIVATE_KEY not set in .env');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet   = new ethers.Wallet(pk, provider);
  const registry = new ethers.Contract(REGISTRY, ABI, wallet);

  const balance = await provider.getBalance(wallet.address);
  console.log(`💼 Wallet: ${wallet.address}`);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} GOAT`);

  if (balance === 0n) {
    console.error('❌ Wallet has 0 GOAT on Testnet3. Please fund it.');
    process.exit(1);
  }

  console.log(`📝 Registering agent on Testnet3 contract...`);
  const tx = await registry.register(GIST_URI);
  console.log(`⏳ Tx submitted: ${tx.hash}`);
  console.log(`🔗 Explorer: https://explorer.testnet3.goat.network/tx/${tx.hash}`);

  const receipt = await tx.wait();
  console.log(`✅ Confirmed in block ${receipt.blockNumber}`);

  const iface = new ethers.Interface(ABI);
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed && parsed.name === 'Transfer') {
        console.log(`\n🎉 Agent registered on Testnet3! Token ID: ${parsed.args.tokenId.toString()}`);
      }
    } catch (_) {}
  }
}

main().catch(e => { console.error(e); process.exit(1); });
