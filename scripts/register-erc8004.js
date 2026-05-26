/**
 * Register this agent on the official ERC-8004 Identity Registry on GOAT Mainnet.
 * Run ONCE after funding the wallet: node scripts/register-erc8004.js
 *
 * Registry: 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 (GOAT Mainnet, Chain 2345)
 */

import 'dotenv/config';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

const REGISTRY_ADDRESS = process.env.ERC8004_REGISTRY || '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';
const RPC_URL          = process.env.GOAT_RPC          || 'https://rpc.goat.network';
const PRIVATE_KEY      = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY || PRIVATE_KEY.includes('YOUR_PRIVATE_KEY')) {
    console.error('❌ Set PRIVATE_KEY in .env before running this script.');
    process.exit(1);
}

// Minimal ABI — only what we need to register
const REGISTRY_ABI = [
    {
        name: 'register',
        type: 'function',
        inputs:  [{ name: 'agentURI', type: 'string' }],
        outputs: [{ name: 'agentId',  type: 'uint256' }],
        stateMutability: 'nonpayable',
    },
    {
        name: 'register',
        type: 'function',
        inputs:  [],
        outputs: [{ name: 'agentId', type: 'uint256' }],
        stateMutability: 'nonpayable',
    },
    {
        name: 'AgentRegistered',
        type: 'event',
        inputs: [
            { name: 'agentId',  type: 'uint256', indexed: true },
            { name: 'owner',    type: 'address', indexed: true },
        ],
    },
];

// Agent card metadata — stored as inline data URI (no external hosting needed)
const agentCard = {
    name:        'AggressiveScalpBot',
    version:     '1.0.0',
    description: 'Autonomous HFT trading agent on GOAT Network. Sells premium alpha signals via x402 protocol. Powered by OpenClaw.',
    wallet:      new ethers.Wallet(PRIVATE_KEY).address,
    capabilities: [
        'x402-micropayments',
        'alpha-signal-oracle',
        'fleet-management',
        'momentum-trading',
    ],
    x402_endpoint:    'http://localhost:3000/api/v1/alpha-signal',
    price_per_signal: '0.001 GOAT',
    network:          'GOAT Mainnet (Chain 2345)',
    built_with:       'OpenClaw / ClawUp',
};

const agentCardJson = JSON.stringify(agentCard, null, 2);
const agentURI = `data:application/json;base64,${Buffer.from(agentCardJson).toString('base64')}`;

async function main() {
    console.log('🚀 ERC-8004 Agent Registration');
    console.log(`📍 Registry: ${REGISTRY_ADDRESS}`);
    console.log(`🌐 RPC:      ${RPC_URL}`);
    console.log(`💼 Wallet:   ${agentCard.wallet}`);
    console.log('');

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet   = new ethers.Wallet(PRIVATE_KEY, provider);

    // Check balance first
    const balance = await provider.getBalance(wallet.address);
    const goat    = parseFloat(ethers.formatEther(balance));
    console.log(`💰 Balance: ${goat.toFixed(6)} GOAT`);

    if (goat < 0.001) {
        console.error('❌ Insufficient balance. Fund this wallet with at least 0.001 GOAT for gas.');
        console.error(`   Address: ${wallet.address}`);
        process.exit(1);
    }

    const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, wallet);

    console.log('📝 Registering agent on ERC-8004 registry...');
    console.log('⏳ Sending transaction...');

    let tx;
    let agentId;

    try {
        // Try register(string agentURI) first
        tx = await registry['register(string)'](agentURI);
        console.log(`🔗 Tx hash: ${tx.hash}`);
        console.log('⏳ Waiting for confirmation...');
        const receipt = await tx.wait();

        // Parse AgentRegistered event to get agentId
        const iface  = new ethers.Interface(REGISTRY_ABI);
        const event  = receipt.logs
            .map(log => { try { return iface.parseLog(log); } catch { return null; } })
            .find(e => e?.name === 'AgentRegistered');
        agentId = event?.args?.agentId?.toString() ?? 'unknown';

    } catch (err) {
        // Fall back to register() with no args (URI-less)
        console.warn('⚠️ register(string) failed, trying register()...');
        tx = await registry['register()']();
        console.log(`🔗 Tx hash: ${tx.hash}`);
        const receipt = await tx.wait();
        const iface   = new ethers.Interface(REGISTRY_ABI);
        const event   = receipt.logs
            .map(log => { try { return iface.parseLog(log); } catch { return null; } })
            .find(e => e?.name === 'AgentRegistered');
        agentId = event?.args?.agentId?.toString() ?? 'unknown';
    }

    console.log('');
    console.log('✅ Agent registered successfully!');
    console.log(`🪪 Agent Token ID: ${agentId}`);
    console.log(`🔗 Tx:            https://explorer.goat.network/tx/${tx.hash}`);
    console.log(`🌐 View on 8004scan: https://8004scan.io`);

    // Save agentId to .env
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, 'utf8');
        if (envContent.includes('AGENT_TOKEN_ID=')) {
            envContent = envContent.replace(/AGENT_TOKEN_ID=.*/, `AGENT_TOKEN_ID=${agentId}`);
        } else {
            envContent += `\nAGENT_TOKEN_ID=${agentId}`;
        }
        fs.writeFileSync(envPath, envContent);
        console.log(`💾 Saved AGENT_TOKEN_ID=${agentId} to .env`);
    }
}

main().catch(err => {
    console.error('❌ Registration failed:', err.message);
    process.exit(1);
});
