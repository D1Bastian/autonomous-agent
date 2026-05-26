import { WebSocketServer } from 'ws';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { OracleServer } from './oracle.js';
import { AgentFleetManager } from './fleet.js';
import { Guardrails } from './guardrails.js';
import { initTelegramBot } from './telegram.js';
import { x402Fetch } from './x402.js';

dotenv.config(); // loads .env from project root (where npm start is run)

const PORT        = process.env.WS_PORT    ? parseInt(process.env.WS_PORT)    : 8080;
const ORACLE_PORT = process.env.ORACLE_PORT ? parseInt(process.env.ORACLE_PORT) : 3000;
const RPC_URL     = process.env.GOAT_RPC   || 'https://rpc.goat.network';
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const MAX_SPEND   = parseFloat(process.env.MAX_SPEND_GOAT ?? '0.005');

console.log('🛡️ AggressiveScalpBot initializing on GOAT Mainnet...');
console.log(`🌐 RPC: ${RPC_URL}`);

const provider = new ethers.JsonRpcProvider(RPC_URL);
let wallet: ethers.Wallet | null = null;

if (PRIVATE_KEY && !PRIVATE_KEY.includes('YOUR_PRIVATE_KEY')) {
    wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    console.log(`💼 Agent Wallet: ${wallet.address}`);
} else {
    console.warn('⚠️ No private key — running in read-only mode.');
}

// Guardrails: enforce max spend per x402 transaction
const guardrails = new Guardrails(MAX_SPEND);
console.log(`🔒 Spending limit: ${MAX_SPEND} GOAT/tx`);

// Fleet manager for sub-agents
const fleet = new AgentFleetManager(RPC_URL);

// WebSocket server for PyQt5 dashboard (kept for visual demo)
const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws) => {
    console.log('🟢 Dashboard UI connected.');
    ws.send(JSON.stringify({
        type:   'status',
        data:   'AggressiveScalpBot connected to GOAT Mainnet.',
        wallet: wallet?.address ?? 'Offline',
    }));

    ws.on('message', async (message: string) => {
        try {
            const data = JSON.parse(message);
            if (data.command === 'spawn_agent') {
                const name = data.name || 'AnonAgent';
                const strategy = data.strategy || 'SCALP';
                const pkey = ethers.Wallet.createRandom().privateKey;
                const agent = fleet.spawnAgent(name, pkey, strategy);
                
                // Broadcast update to all clients
                const agentsList = await Promise.all(fleet.getAllAgents().map(async (a) => ({
                    name: a.name,
                    strategy: a.strategy,
                    wallet: a.wallet.address,
                    balance: await a.getBalance(),
                })));
                
                ws.send(JSON.stringify({
                    type: 'fleet_update',
                    agents: agentsList,
                }));
                
                ws.send(JSON.stringify({
                    type: 'log',
                    message: `Spawned ${name} (${strategy}) at wallet ${agent.wallet.address}`,
                }));
            } else if (data.command === 'test_x402') {
                ws.send(JSON.stringify({
                    type: 'log',
                    message: 'Running local x402 payment test...',
                }));
                
                if (!wallet) {
                    ws.send(JSON.stringify({
                        type: 'log',
                        message: '❌ Error: No wallet configured.',
                    }));
                    return;
                }
                
                const oracleUrl = `http://localhost:${ORACLE_PORT}/api/v1/alpha-signal`;
                try {
                    const result = await x402Fetch(
                        oracleUrl,
                        {},
                        wallet,
                        guardrails,
                        {
                            onPaymentRequired: (amount, to, sym) => {
                                const currency = sym || 'GOAT';
                                ws.send(JSON.stringify({
                                    type: 'log',
                                    message: `💸 x402: Oracle demands ${amount} ${currency} -> ${to}`,
                                }));
                            },
                            onPaying: (txHash) => {
                                ws.send(JSON.stringify({
                                    type: 'log',
                                    message: `🤖 x402: Paying on-chain... Tx: ${txHash}`,
                                }));
                            },
                            onConfirmed: (txHash) => {
                                ws.send(JSON.stringify({
                                    type: 'log',
                                    message: `✅ x402: Payment confirmed!`,
                                }));
                            }
                        }
                    );
                    
                    if (result.ok) {
                        const signal = await result.json();
                        ws.send(JSON.stringify({
                            type: 'log',
                            message: `🎉 Premium Alpha Signal Unlocked: ${JSON.stringify(signal)}`,
                        }));
                    } else {
                        ws.send(JSON.stringify({
                            type: 'log',
                            message: `❌ x402 Test Failed: HTTP ${result.status}`,
                        }));
                    }
                } catch (e: any) {
                    ws.send(JSON.stringify({
                        type: 'log',
                        message: `❌ x402 Test Blocked/Failed: ${e.message}`,
                    }));
                }
            }
        } catch (e: any) {
            console.error('WebSocket command error:', e.message);
        }
    });
});

console.log(`📡 WebSocket IPC on port ${PORT}`);

// Oracle x402 server — serves alpha signals for 0.001 GOAT
if (wallet) {
    const oracle = new OracleServer(provider, wallet.address, '0.000001');
    oracle.start(ORACLE_PORT);
}

// Telegram bot — primary user interface
initTelegramBot(wallet, provider, fleet, guardrails, ORACLE_PORT);

// Telemetry loop — broadcasts balance to WebSocket dashboard
async function agentLoop() {
    while (true) {
        if (wallet) {
            try {
                const balance = await provider.getBalance(wallet.address);
                const goat    = ethers.formatEther(balance);
                wss.clients.forEach(client => {
                    if (client.readyState === 1) {
                        client.send(JSON.stringify({
                            type:      'telemetry',
                            balance:   goat,
                            timestamp: new Date().toISOString(),
                        }));
                    }
                });
            } catch {
                // RPC hiccup — skip this tick
            }
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
}

agentLoop();
