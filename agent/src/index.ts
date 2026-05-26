import { WebSocketServer } from 'ws';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { OracleServer } from './oracle.js';
import { AgentFleetManager } from './fleet.js';
import { Guardrails } from './guardrails.js';
import { AutoTrader } from './trader.js';
import { initTelegramBot } from './telegram.js';

dotenv.config({ path: '.env' });

const PORT        = process.env.WS_PORT    ? parseInt(process.env.WS_PORT)    : 8080;
const ORACLE_PORT = process.env.ORACLE_PORT ? parseInt(process.env.ORACLE_PORT) : 3000;
const RPC_URL     = process.env.GOAT_RPC   || 'https://rpc.goat.network';
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const MAX_SPEND   = parseFloat(process.env.MAX_SPEND_GOAT ?? '0.005');

console.log('🛡️ AggressiveScalpBot initializing on GOAT Mainnet...');
console.log(`🌐 RPC: ${RPC_URL}`);

const provider = new ethers.JsonRpcProvider(RPC_URL);
let wallet: ethers.Wallet | null = null;

const isValidKey = PRIVATE_KEY && /^(0x)?[0-9a-fA-F]{64}$/.test(PRIVATE_KEY.trim());
if (isValidKey) {
    wallet = new ethers.Wallet(PRIVATE_KEY!.trim(), provider);
    console.log(`💼 Agent Wallet: ${wallet.address}`);
} else {
    console.warn('⚠️ No valid private key — running in read-only mode.');
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
});

console.log(`📡 WebSocket IPC on port ${PORT}`);

// Oracle x402 server — serves alpha signals for 0.001 GOAT
if (wallet) {
    const oracle = new OracleServer(provider, wallet.address, '0.000001');
    oracle.start(ORACLE_PORT);
}

// AutoTrader — autonomous trading engine (activated via /autotrade on)
const trader = wallet ? new AutoTrader(wallet, guardrails, ORACLE_PORT, () => {}) : null;

// Telegram bot — skipped when OpenClaw owns the token (OPENCLAW_MODE=true)
if (process.env.OPENCLAW_MODE !== 'true') {
    initTelegramBot(wallet, provider, fleet, guardrails, ORACLE_PORT, trader);
} else {
    console.log('🤖 Telegram bot disabled — OpenClaw handles Telegram.');
}

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
