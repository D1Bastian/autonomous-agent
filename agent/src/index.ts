import { WebSocketServer } from 'ws';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { x402Fetch } from './x402';
import { OracleServer } from './oracle';

dotenv.config({ path: '../.env' }); // Load from root

const PORT = process.env.WS_PORT ? parseInt(process.env.WS_PORT) : 8080;
const ORACLE_PORT = process.env.ORACLE_PORT ? parseInt(process.env.ORACLE_PORT) : 3000;
const RPC_URL = process.env.GOAT_RPC || 'https://rpc.testnet3.goat.network';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

console.log('🛡️ Aegis/OpenClaw Agent Core initializing...');

// Initialize Provider & Wallet
const provider = new ethers.JsonRpcProvider(RPC_URL);
let wallet: ethers.Wallet | null = null;

if (PRIVATE_KEY && !PRIVATE_KEY.includes('YOUR_PRIVATE_KEY')) {
    wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    console.log(`💼 Agent Wallet Loaded: ${wallet.address}`);
} else {
    console.warn('⚠️ No private key found. Running in offline/read-only mode.');
}

// Initialize WebSocket Server for UI IPC
const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws) => {
  console.log('🟢 Dashboard UI connected via WebSocket.');
  
  ws.send(JSON.stringify({ 
      type: 'status', 
      data: 'Agent connected to OpenClaw framework.',
      wallet: wallet ? wallet.address : 'Offline'
  }));

  ws.on('message', async (message) => {
    const data = JSON.parse(message.toString());
    console.log(`Received command =>`, data);
    
    if (data.command === 'test_x402' && wallet) {
        // This is a placeholder for a true x402-gated API endpoint.
        // In a real scenario, this would be an API that charges per request.
        ws.send(JSON.stringify({ type: 'log', message: 'Initiating x402 simulated fetch...' }));
        
        try {
            // Simulated x402 target (using a public endpoint just for compilation, 
            // though it won't actually return a 402 in this demo)
            const res = await x402Fetch('https://api.coindesk.com/v1/bpi/currentprice.json', {}, wallet);
            ws.send(JSON.stringify({ type: 'log', message: `Fetch complete. Status: ${res.status}` }));
        } catch (e: any) {
            ws.send(JSON.stringify({ type: 'error', message: e.message }));
        }
    }
  });
});

console.log(`📡 WebSocket IPC server running on port ${PORT}`);

// Initialize the Oracle Server
if (wallet) {
    // We charge 0.001 GOAT per API request
    const oracle = new OracleServer(provider, wallet.address, "0.001");
    oracle.start(ORACLE_PORT);
}

// --- Agent Brain Loop (OpenClaw Framework Concept) ---
async function agentLoop() {
    while (true) {
        if (wallet) {
            try {
                const balance = await provider.getBalance(wallet.address);
                const ethBalance = ethers.formatEther(balance);
                
                // Broadcast to UI
                wss.clients.forEach(client => {
                    if (client.readyState === 1) { // OPEN
                        client.send(JSON.stringify({
                            type: 'telemetry',
                            balance: ethBalance,
                            timestamp: new Date().toISOString()
                        }));
                    }
                });
            } catch (e) {
                console.error('Telemetry error:', e);
            }
        }
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
}

agentLoop();
