import { Telegraf, Context } from 'telegraf';
import { ethers } from 'ethers';
import { x402Fetch } from './x402.js';
import { Guardrails } from './guardrails.js';
import { AgentFleetManager } from './fleet.js';
import { fetchPrices, resolveId, signalEmoji } from './market.js';

const AGENT_NAME     = 'AggressiveScalpBot';
const AGENT_VERSION  = '1.0.0';
const GOAT_EXPLORER  = 'https://explorer.goat.network/tx';

function fmt(text: string): string {
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

const IDENTITY_CARD = `
🛡️ *${AGENT_NAME}* v${AGENT_VERSION}

I am an autonomous HFT trading agent running on GOAT Network.

*What I do:*
• Monitor live BTC/ETH markets and generate momentum signals
• Autonomously pay for premium alpha signals via the *x402 protocol*
• Manage a fleet of specialized sub-agents (Scalper, Maker, Arbitrageur)
• Enforce human-in-the-loop spending limits on every transaction

*On-chain identity:* ERC-8004 registered on GOAT Mainnet
*Payment protocol:* x402 (machine-to-machine micropayments)
*Network:* GOAT Network Mainnet (Bitcoin-secured)

*Commands:*
/status   — Wallet balance & agent metrics
/price    — Live market prices & signals
/signal   — Buy a premium alpha signal via x402
/agents   — List active fleet agents
/spawn    — Spawn a sub-agent (e.g. /spawn scalper)
/setlimit — Set spending limit (e.g. /setlimit 0.01)
/danger   — Try a high-risk operation (guardrail demo)
/help     — Show this card
`.trim();

export function initTelegramBot(
    wallet: ethers.Wallet | null,
    provider: ethers.Provider,
    fleet: AgentFleetManager,
    guardrails: Guardrails,
    oraclePort: number
) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        console.warn('⚠️ TELEGRAM_BOT_TOKEN not set — Telegram bot disabled.');
        return;
    }

    const bot = new Telegraf(token);

    // ── /start & /help ────────────────────────────────────────────────────────
    bot.start((ctx) => ctx.replyWithMarkdown(IDENTITY_CARD));
    bot.help((ctx)  => ctx.replyWithMarkdown(IDENTITY_CARD));

    // Natural-language self-disclosure
    bot.hears(/what (do you|can you|are you|does this)/i, (ctx) =>
        ctx.replyWithMarkdown(IDENTITY_CARD)
    );

    // ── /status ───────────────────────────────────────────────────────────────
    bot.command('status', async (ctx) => {
        if (!wallet) {
            return ctx.reply('⚠️ Agent running in read-only mode — no wallet configured.');
        }
        try {
            const balance  = await provider.getBalance(wallet.address);
            const goat     = parseFloat(ethers.formatEther(balance)).toFixed(6);
            const agents   = fleet.getAllAgents();
            const limit    = guardrails.getLimit().toFixed(6);
            const spent    = guardrails.getSpent().toFixed(6);

            const text = [
                `🛡️ *${AGENT_NAME} Status*`,
                ``,
                `💼 Wallet: \`${wallet.address}\``,
                `💰 Balance: *${goat} GOAT*`,
                ``,
                `🤖 Fleet: ${agents.length} active agent(s)`,
                `🔒 Spend limit: ${limit} GOAT/tx`,
                `📊 Spent this session: ${spent} GOAT`,
                ``,
                `🌐 Network: GOAT Mainnet (Chain 2345)`,
                `🔮 Oracle: http://localhost:${oraclePort}/api/v1/alpha-signal`,
            ].join('\n');

            return ctx.replyWithMarkdown(text);
        } catch (e: any) {
            return ctx.reply(`❌ Status error: ${e.message}`);
        }
    });

    // ── /price ────────────────────────────────────────────────────────────────
    bot.command('price', async (ctx) => {
        const arg = ctx.message.text.split(' ')[1];
        const ids  = arg
            ? [resolveId(arg)]
            : ['bitcoin', 'ethereum'];

        const msg = await ctx.reply('📡 Fetching live prices...');

        try {
            const prices = await fetchPrices(ids);
            const lines  = prices.map(p => {
                const dir   = p.change24h >= 0 ? '+' : '';
                const emoji = signalEmoji(p.signal);
                return [
                    `${emoji} *${p.asset}*`,
                    `   Price: $${p.priceUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
                    `   24h:   ${dir}${p.change24h}%`,
                    `   Signal: \`${p.signal}\``,
                ].join('\n');
            });

            await ctx.telegram.editMessageText(
                msg.chat.id, msg.message_id, undefined,
                `📊 *Live Market Data*\n\n${lines.join('\n\n')}`,
                { parse_mode: 'Markdown' }
            );
        } catch (e: any) {
            await ctx.telegram.editMessageText(
                msg.chat.id, msg.message_id, undefined,
                `❌ Price fetch failed: ${e.message}`
            );
        }
    });

    // ── /signal (the x402 demo) ───────────────────────────────────────────────
    bot.command('signal', async (ctx) => {
        if (!wallet) {
            return ctx.reply('⚠️ No wallet — cannot execute x402 payment.');
        }

        const oracleUrl = `http://localhost:${oraclePort}/api/v1/alpha-signal`;
        const msg = await ctx.reply('🔮 Requesting alpha signal from oracle...');

        const edit = (text: string) =>
            ctx.telegram.editMessageText(msg.chat.id, msg.message_id, undefined, text, {
                parse_mode: 'Markdown',
            });

        try {
            const steps: string[] = ['🔮 *Contacting Oracle...*'];
            await edit(steps.join('\n'));

            const result = await x402Fetch(
                oracleUrl,
                {},
                wallet,
                guardrails,
                {
                    onPaymentRequired: async (amount, to) => {
                        steps.push(`💸 Oracle demands *${amount} GOAT* via x402`);
                        steps.push(`📬 Recipient: \`${to}\``);
                        await edit(steps.join('\n'));
                    },
                    onPaying: async (txHash) => {
                        steps.push(`🤖 Agent paying on-chain...`);
                        steps.push(`🔗 Tx: \`${txHash}\``);
                        await edit(steps.join('\n'));
                    },
                    onConfirmed: async (txHash) => {
                        steps.push(`✅ Payment confirmed!`);
                        await edit(steps.join('\n'));
                    },
                }
            );

            if (!result.ok) {
                const err = await result.json() as { error?: string; details?: string };
                throw new Error(err.details ?? err.error ?? `HTTP ${result.status}`);
            }

            const signal = await result.json() as {
                asset: string;
                signal: string;
                confidence: number;
                target: number;
                paidVia: string;
            };

            const finalText = [
                `✅ *Alpha Signal Delivered*`,
                ``,
                `📈 Asset:      ${signal.asset}`,
                `🎯 Signal:     \`${signal.signal}\``,
                `📊 Confidence: ${(signal.confidence * 100).toFixed(0)}%`,
                `💲 Target:     $${signal.target.toLocaleString('en-US')}`,
                ``,
                `💸 Paid via x402 on GOAT Network`,
                `🔗 [View Tx on Explorer](${GOAT_EXPLORER}/${signal.paidVia})`,
            ].join('\n');

            await edit(finalText);
        } catch (e: any) {
            await edit(`🚨 *Transaction Blocked*\n\n${e.message}`);
        }
    });

    // ── /setlimit ─────────────────────────────────────────────────────────────
    bot.command('setlimit', async (ctx) => {
        const arg   = ctx.message.text.split(' ')[1];
        const goat  = parseFloat(arg);

        if (isNaN(goat) || goat < 0) {
            return ctx.reply('Usage: /setlimit 0.01\nSets max GOAT per transaction.');
        }

        guardrails.setLimit(goat);
        return ctx.replyWithMarkdown(
            `🔒 *Spending limit updated*\n\nMax per transaction: *${goat.toFixed(6)} GOAT*\n\nRun /signal to test.`
        );
    });

    // ── /danger (guardrail demo) ──────────────────────────────────────────────
    bot.command('danger', async (ctx) => {
        const HIGH_RISK_AMOUNT = 10; // GOAT
        const msg = await ctx.reply(`⚠️ Attempting high-risk operation: transfer ${HIGH_RISK_AMOUNT} GOAT...`);

        try {
            guardrails.checkAndRecord(HIGH_RISK_AMOUNT);
            // If we reach here the limit is set very high
            await ctx.telegram.editMessageText(
                msg.chat.id, msg.message_id, undefined,
                `✅ Operation allowed (limit is ${guardrails.getLimit()} GOAT). Use /setlimit 0.005 to tighten.`
            );
        } catch (e: any) {
            await ctx.telegram.editMessageText(
                msg.chat.id, msg.message_id, undefined,
                [
                    `🚨 *Human-in-the-Loop Guardrail Triggered*`,
                    ``,
                    `Attempted: *${HIGH_RISK_AMOUNT} GOAT*`,
                    `Your limit: *${guardrails.getLimit().toFixed(6)} GOAT*`,
                    ``,
                    `Transaction was automatically blocked.`,
                    `Use /setlimit to change your limit.`,
                ].join('\n'),
                { parse_mode: 'Markdown' }
            );
        }
    });

    // ── /spawn ────────────────────────────────────────────────────────────────
    bot.command('spawn', async (ctx) => {
        const arg      = (ctx.message.text.split(' ')[1] ?? 'scalper').toUpperCase();
        const strategy = ['SCALP', 'MAKER', 'ARBITRAGEUR'].includes(arg) ? arg : 'SCALP';
        const name     = `Auto-${strategy}-${Date.now().toString(36).slice(-4).toUpperCase()}`;

        const agent = fleet.spawnAgent(name, ethers.Wallet.createRandom().privateKey, strategy);

        return ctx.replyWithMarkdown(
            `🧬 *Agent Spawned*\n\nName:     ${name}\nStrategy: ${strategy}\nWallet:   \`${agent.wallet.address}\`\n\nUse /agents to see your fleet.`
        );
    });

    // ── /agents ───────────────────────────────────────────────────────────────
    bot.command('agents', async (ctx) => {
        const agents = fleet.getAllAgents();
        if (agents.length === 0) {
            return ctx.reply('No agents spawned yet. Use /spawn scalper to create one.');
        }

        const lines = agents.map((a, i) =>
            `${i + 1}. *${a.name}* [${a.strategy}]\n   \`${a.wallet.address}\``
        );

        return ctx.replyWithMarkdown(`🛡️ *Active Fleet (${agents.length} agents)*\n\n${lines.join('\n\n')}`);
    });

    // ── fallback ──────────────────────────────────────────────────────────────
    bot.on('text', (ctx) => {
        const text = ctx.message.text.toLowerCase();
        if (text.includes('what') || text.includes('who') || text.includes('help')) {
            ctx.replyWithMarkdown(IDENTITY_CARD);
        }
    });

    bot.launch();
    console.log('🤖 Telegram bot launched (long-polling)');

    process.once('SIGINT',  () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
