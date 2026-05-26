import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { fetchPrices, resolveId, signalEmoji } from './market.js';
import { x402Fetch } from './x402.js';
import { Guardrails } from './guardrails.js';
import { AgentFleetManager } from './fleet.js';
import { OracleServer } from './oracle.js';
import { AutoTrader } from './trader.js';

const RPC_URL    = process.env.GOAT_RPC || 'https://rpc.goat.network';
const ORACLE_PORT = parseInt(process.env.ORACLE_PORT ?? '3000');
const MAX_SPEND  = parseFloat(process.env.MAX_SPEND_GOAT ?? '0.005');
const PRIVATE_KEY = process.env.PRIVATE_KEY;

const isValidKey = PRIVATE_KEY && /^(0x)?[0-9a-fA-F]{64}$/.test(PRIVATE_KEY.trim());
if (!isValidKey) {
    process.stderr.write('ERROR: No valid PRIVATE_KEY in .env\n');
    process.exit(1);
}

const provider   = new ethers.JsonRpcProvider(RPC_URL);
const wallet     = new ethers.Wallet(PRIVATE_KEY!.trim(), provider);
const guardrails = new Guardrails(MAX_SPEND);
const fleet      = new AgentFleetManager(RPC_URL);
const oracle     = new OracleServer(provider, wallet.address, '0.000001');
const trader     = new AutoTrader(wallet, guardrails, ORACLE_PORT, (msg) => {
    process.stderr.write(msg + '\n');
});

oracle.start(ORACLE_PORT);
process.stderr.write(`AggressiveScalpBot MCP server starting. Wallet: ${wallet.address}\n`);

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOL_DEFINITIONS = [
    {
        name: 'get_price',
        description: 'Fetch live BTC/ETH (or any) prices from CoinGecko with momentum signal. Always call this for price questions.',
        inputSchema: {
            type: 'object',
            properties: {
                assets: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Asset symbols or CoinGecko IDs, e.g. ["btc","eth"]',
                },
            },
            required: ['assets'],
        },
    },
    {
        name: 'buy_signal',
        description: 'Pay 0.000001 GOAT via x402 protocol to oracle, get alpha trading signal. Makes a REAL on-chain transaction.',
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'get_status',
        description: 'Get agent wallet balance, spending limits, positions count, and AutoTrader state.',
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'set_limit',
        description: 'Update the max GOAT spend per x402 transaction (guardrail).',
        inputSchema: {
            type: 'object',
            properties: {
                amount: { type: 'number', description: 'Max GOAT per transaction, e.g. 0.001' },
            },
            required: ['amount'],
        },
    },
    {
        name: 'start_autotrade',
        description: 'Start autonomous trading loop — monitors BTC+ETH every 30s, opens LONG on STRONG_BUY, exits on SELL or stop-loss/take-profit.',
        inputSchema: {
            type: 'object',
            properties: {
                assets: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Assets to monitor. Defaults to ["bitcoin","ethereum"]',
                },
            },
        },
    },
    {
        name: 'stop_autotrade',
        description: 'Stop the autonomous trading loop and return session summary.',
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'get_positions',
        description: 'Show all open trading positions with live P&L from real-time prices.',
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'get_history',
        description: 'Show recent closed trades with entry/exit prices, P&L, duration, and close reason.',
        inputSchema: {
            type: 'object',
            properties: {
                n: { type: 'number', description: 'Number of trades to return (default 5)' },
            },
        },
    },
    {
        name: 'close_position',
        description: 'Manually close an open position at current market price.',
        inputSchema: {
            type: 'object',
            properties: {
                asset: { type: 'string', description: 'Asset to close, e.g. "btc" or "eth"' },
            },
            required: ['asset'],
        },
    },
    {
        name: 'spawn_agent',
        description: 'Spawn a new fleet sub-agent with a fresh wallet and trading strategy.',
        inputSchema: {
            type: 'object',
            properties: {
                strategy: {
                    type: 'string',
                    enum: ['scalper', 'maker', 'arbitrageur'],
                    description: 'Trading strategy for this sub-agent',
                },
            },
            required: ['strategy'],
        },
    },
    {
        name: 'list_agents',
        description: 'List all active fleet sub-agents with their wallet addresses and strategies.',
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'danger',
        description: 'Attempt a high-risk 10 GOAT transaction to demo the guardrail system blocking it.',
        inputSchema: { type: 'object', properties: {} },
    },
];

// ── Tool handler ──────────────────────────────────────────────────────────────

function ok(text: string) {
    return { content: [{ type: 'text' as const, text }] };
}

function fmtPnl(pct: number): string {
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${(pct * 100).toFixed(2)}%`;
}

async function handleToolCall(req: { params: { name: string; arguments?: Record<string, unknown> } }) {
    const args = req.params.arguments ?? {};

    try {
        switch (req.params.name) {

            case 'get_price': {
                const rawAssets = (args.assets as string[]) ?? ['bitcoin', 'ethereum'];
                const coinIds   = rawAssets.map(resolveId);
                const prices    = await fetchPrices(coinIds);
                const lines = prices.map(p =>
                    `${signalEmoji(p.signal)} ${p.asset}  $${p.priceUsd.toLocaleString('en-US')}  ${p.change24h >= 0 ? '+' : ''}${p.change24h}% (24h)  →  ${p.signal}`
                );
                return ok(`Live Prices\n\n${lines.join('\n')}`);
            }

            case 'buy_signal': {
                const oracleUrl = `http://localhost:${ORACLE_PORT}/api/v1/alpha-signal`;
                let confirmedTxHash = 'pending';
                const res = await x402Fetch(oracleUrl, {}, wallet, guardrails, {
                    onPaymentRequired: (amt, to) => process.stderr.write(`x402: paying ${amt} GOAT to ${to}\n`),
                    onPaying:          (hash)    => { confirmedTxHash = hash; },
                    onConfirmed:       (hash)    => { confirmedTxHash = hash; },
                });
                const data = await res.json() as { signal: string; confidence: number; paidVia?: string; asset?: string };
                const txHash = data.paidVia ?? confirmedTxHash;
                return ok(
                    `Alpha Signal Received\n\n` +
                    `Signal:     ${data.signal}\n` +
                    `Confidence: ${((data.confidence ?? 0) * 100).toFixed(0)}%\n` +
                    `Asset:      ${data.asset ?? 'BTC/GOAT'}\n` +
                    `Paid via:   x402 (0.000001 GOAT on GOAT Mainnet)\n` +
                    `Tx hash:    ${txHash}`
                );
            }

            case 'get_status': {
                const balance  = await provider.getBalance(wallet.address);
                const goat     = parseFloat(ethers.formatEther(balance)).toFixed(6);
                const agents   = fleet.getAllAgents();
                const positions = trader.getAllPositions();
                return ok(
                    `AggressiveScalpBot Status\n\n` +
                    `Wallet:      ${wallet.address}\n` +
                    `Balance:     ${goat} GOAT\n` +
                    `Spend limit: ${guardrails.getLimit().toFixed(6)} GOAT/tx\n` +
                    `Spent today: ${guardrails.getSpent().toFixed(6)} GOAT\n` +
                    `AutoTrader:  ${trader.isRunning() ? 'RUNNING' : 'STOPPED'}\n` +
                    `Positions:   ${positions.length} open\n` +
                    `Fleet:       ${agents.length} agent(s)\n` +
                    `ERC-8004:    Token #45 on GOAT Mainnet\n` +
                    `Network:     GOAT Mainnet (Chain 2345)`
                );
            }

            case 'set_limit': {
                const amount = args.amount as number;
                if (typeof amount !== 'number' || amount < 0) throw new Error('amount must be a non-negative number');
                guardrails.setLimit(amount);
                return ok(`Spending limit updated to ${amount.toFixed(6)} GOAT/tx.\nAll future x402 payments are capped at this amount.`);
            }

            case 'start_autotrade': {
                if (trader.isRunning()) return ok('AutoTrader is already running.');
                const rawAssets = (args.assets as string[] | undefined) ?? ['bitcoin', 'ethereum'];
                const coinIds   = rawAssets.map(resolveId);
                trader.start(coinIds);
                const prices = await fetchPrices(coinIds);
                const snapshot = prices.map(p => `  ${p.asset}: $${p.priceUsd.toLocaleString()} (${p.signal})`).join('\n');
                return ok(
                    `AutoTrader STARTED\n\n` +
                    `Monitoring: ${prices.map(p => p.asset).join(', ')}\n` +
                    `Interval:   30 seconds\n` +
                    `Strategy:   LONG on STRONG_BUY\n` +
                    `Stop-loss:  -3% | Take-profit: +5%\n` +
                    `x402 proof: every trade confirmed on-chain\n\n` +
                    `Current market:\n${snapshot}`
                );
            }

            case 'stop_autotrade': {
                if (!trader.isRunning()) return ok('AutoTrader is not running.');
                trader.stop();
                const history = trader.getHistory(5);
                if (history.length === 0) return ok('AutoTrader stopped. No trades this session.');
                const lines = history.map(t => {
                    const sign = t.pnlPct >= 0 ? '+' : '';
                    return `  ${t.asset} | Entry $${t.entryPrice.toLocaleString()} → Exit $${t.exitPrice.toLocaleString()} | ${sign}${(t.pnlPct * 100).toFixed(2)}% | ${t.reason} | ${t.duration}`;
                });
                return ok(`AutoTrader stopped.\n\nSession trades:\n${lines.join('\n')}`);
            }

            case 'get_positions': {
                const positions = trader.getAllPositions();
                if (positions.length === 0) {
                    return ok('No open positions.\nUse start_autotrade to begin monitoring, or buy_signal to get an alpha signal.');
                }
                const prices = await fetchPrices(positions.map(p => p.coinId));
                const lines = positions.map(pos => {
                    const cur  = prices.find(p => p.id === pos.coinId)?.priceUsd ?? pos.entryPrice;
                    const pnl  = (cur - pos.entryPrice) / pos.entryPrice;
                    const dur  = Math.floor((Date.now() - pos.entryTime.getTime()) / 60000);
                    return (
                        `${pos.asset} LONG\n` +
                        `  Entry:  $${pos.entryPrice.toLocaleString('en-US')}\n` +
                        `  Now:    $${cur.toLocaleString('en-US')}  (${fmtPnl(pnl)})\n` +
                        `  Stop:   $${pos.stopLoss.toLocaleString('en-US', { maximumFractionDigits: 0 })}  |  Target: $${pos.takeProfit.toLocaleString('en-US', { maximumFractionDigits: 0 })}\n` +
                        `  Open:   ${dur}m\n` +
                        `  Tx:     ${pos.txHash.startsWith('0x') ? pos.txHash.slice(0, 20) + '...' : pos.txHash}`
                    );
                });
                return ok(`Open Positions (${positions.length})\n\n${lines.join('\n\n')}`);
            }

            case 'get_history': {
                const n       = typeof args.n === 'number' ? args.n : 5;
                const history = trader.getHistory(n);
                if (history.length === 0) return ok('No closed trades yet this session.');
                const lines = history.map((t, i) => {
                    const sign = t.pnlPct >= 0 ? '+' : '';
                    const icon = t.reason === 'STOP_LOSS' ? '🛑' : t.reason === 'TAKE_PROFIT' ? '🎯' : t.reason === 'MANUAL' ? '🤚' : '✅';
                    return `${i + 1}. ${icon} ${t.asset} LONG  ${sign}${(t.pnlPct * 100).toFixed(2)}%  |  $${t.entryPrice.toLocaleString()} → $${t.exitPrice.toLocaleString()}  |  ${t.duration}  |  ${t.reason}`;
                });
                return ok(`Last ${history.length} trade(s):\n\n${lines.join('\n')}`);
            }

            case 'close_position': {
                const coinId = resolveId(args.asset as string);
                const pos    = trader.getPosition(coinId);
                if (!pos) return ok(`No open position for ${(args.asset as string).toUpperCase()}.`);
                const [price] = await fetchPrices([coinId]);
                trader.closePosition(coinId, price.priceUsd, 'MANUAL');
                const pnl = (price.priceUsd - pos.entryPrice) / pos.entryPrice;
                return ok(
                    `Position closed manually.\n\n` +
                    `${pos.asset} LONG\n` +
                    `Entry: $${pos.entryPrice.toLocaleString()} → Exit: $${price.priceUsd.toLocaleString()}\n` +
                    `P&L:   ${fmtPnl(pnl)}`
                );
            }

            case 'spawn_agent': {
                const strategy = ((args.strategy as string) ?? 'scalper').toUpperCase();
                const names: Record<string, string> = { SCALPER: 'Scalper', MAKER: 'Maker', ARBITRAGEUR: 'Arb' };
                const name    = `${names[strategy] ?? strategy}-${Date.now().toString(36).slice(-4)}`;
                const privKey = ethers.Wallet.createRandom().privateKey;
                const agent   = fleet.spawnAgent(name, privKey, strategy);
                return ok(
                    `Sub-agent spawned\n\n` +
                    `Name:     ${agent.name}\n` +
                    `Strategy: ${agent.strategy}\n` +
                    `Wallet:   ${agent.wallet.address}\n` +
                    `ID:       ${agent.id}\n\n` +
                    `Agent registered in fleet. Use list_agents to see all agents.`
                );
            }

            case 'list_agents': {
                const agents = fleet.getAllAgents();
                if (agents.length === 0) return ok('No sub-agents spawned yet.\nUse spawn_agent to deploy one.');
                const lines = agents.map((a, i) =>
                    `${i + 1}. ${a.name} [${a.strategy}]\n   Wallet: ${a.wallet.address}`
                );
                return ok(`Fleet Agents (${agents.length})\n\n${lines.join('\n\n')}`);
            }

            case 'danger': {
                try {
                    guardrails.checkAndRecord(10);
                    return ok('Operation allowed (guardrail not triggered).');
                } catch (e: any) {
                    return ok(
                        `BLOCKED by Guardrails\n\n` +
                        `Attempted: Transfer 10 GOAT\n` +
                        `Limit:     ${guardrails.getLimit().toFixed(6)} GOAT/tx\n` +
                        `Status:    REJECTED\n\n` +
                        `${e.message}`
                    );
                }
            }

            default:
                return ok(`Unknown tool: ${req.params.name}`);
        }
    } catch (e: any) {
        return ok(`Error: ${e.message ?? String(e)}`);
    }
}

// ── Server bootstrap ──────────────────────────────────────────────────────────

const server = new Server(
    { name: 'scalp-tools', version: '1.0.0' },
    { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOL_DEFINITIONS }));
server.setRequestHandler(CallToolRequestSchema,  handleToolCall);

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    process.stderr.write('MCP server connected and ready.\n');
}

main().catch(e => { process.stderr.write(`MCP fatal: ${e.message}\n`); process.exit(1); });
