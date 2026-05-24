import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

function generate() {
  const wallet = ethers.Wallet.createRandom();
  console.log("🧬 Generated New Agent Wallet!");
  console.log("💼 Address:", wallet.address);
  console.log("🔑 Private Key:", wallet.privateKey);

  const envPath = path.resolve(process.cwd(), '.env');
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  // Replace placeholders
  envContent = envContent.replace(/PRIVATE_KEY=YOUR_PRIVATE_KEY_HERE|PRIVATE_KEY=/g, `PRIVATE_KEY=${wallet.privateKey}`);
  
  fs.writeFileSync(envPath, envContent, 'utf8');
  console.log("💾 Updated .env file with the new private key.");
  console.log("\n⚠️ To deploy the identity contract, please fund this wallet using the faucet:");
  console.log("🔗 https://bridge.testnet3.goat.network/faucet");
}

generate();
