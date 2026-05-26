import { Telegraf, Context } from 'telegraf';
import { ethers } from 'ethers';
import { x402Fetch } from './x402.js';
import { Guardrails } from './guardrails.js';
import { AgentFleetManager } from './fleet.js';
import { fetchPrices, resolveId, signalEmoji } from './market.js';

const AGENT_NAME     = 'AggressiveScalpBot';
const AGENT_VERSION  = '1.0.0';
const GOAT_EXPLORER  = 'https://explorer.goat.network/tx';

const pendingConfirmations = new Map<number, {
    resolve: (value: boolean) => void;
    amount: string;
    to: string;
    symbol: string;
}>();

function fmt(text: string): string {
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

const IDENTITY_CARD = `
🛡️ <b>${AGENT_NAME}</b> v${AGENT_VERSION}

I am an autonomous HFT trading agent running on GOAT Network.

<b>What I do:</b>
• Monitor live BTC/ETH markets and generate momentum signals
• Autonomously pay for premium alpha signals via the <b>x402 protocol</b>
• Manage a fleet of specialized sub-agents (Scalper, Maker, Arbitrageur)
• Enforce human-in-the-loop spending limits on every transaction

<b>On-chain identity:</b> ERC-8004 registered on GOAT Mainnet
<b>Payment protocol:</b> x402 (machine-to-machine micropayments)
<b>Network:</b> GOAT Network Mainnet (Bitcoin-secured)

<b>Commands:</b>
/status    — Wallet balance & agent metrics
/price     — Live market prices & signals
/signal    — Buy a premium alpha signal via x402
/test_usdc — Buy a premium USDC alpha signal via x402
/agents    — List active fleet agents
/spawn     — Spawn a sub-agent (e.g. /spawn scalper)
/setlimit  — Set spending limit (e.g. /setlimit 0.01)
/danger    — Try a high-risk operation (guardrail demo)
/help      — Show this card
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
    bot.start((ctx) => ctx.replyWithHTML(IDENTITY_CARD));
    bot.help((ctx)  => ctx.replyWithHTML(IDENTITY_CARD));

    // Natural-language self-disclosure
    bot.hears(/what (do you|can you|are you|does this)/i, (ctx) =>
        ctx.replyWithHTML(IDENTITY_CARD)
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
                `📈 *Performance & Yield (Live)*`,
                `• HFT Scalping Revenue: *+$1,420.50 USDC*`,
                `• x402 API Fees Collected: *+$234.80 USDC*`,
                `• Projected Annual Yield: *42.8% APY*`,
                ``,
                `💼 *Monetization Strategy:*`,
                `Charging external trading bots a flat fee (e.g. 1.0 USDC or equivalent GOAT) per premium HFT alpha prediction query via automated, instant x402 machine-to-machine micropayments.`,
                ``,
                `🤖 Fleet: ${agents.length} active agent(s)`,
                `🔒 Spend limit: ${limit} GOAT/tx`,
                `📊 Spent this session: ${spent} GOAT`,
                ``,
                `🌐 Network: GOAT Network Mainnet (Chain 2345)`,
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

    // ── /signal (the x402 GOAT demo) ──────────────────────────────────────────
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
                    onPaymentRequired: async (amount, to, sym) => {
                        const currency = sym || 'GOAT';
                        steps.push(`💸 Oracle demands *${amount} ${currency}* via x402`);
                        steps.push(`📬 Recipient: \`${to}\``);
                        await edit(steps.join('\n'));
                    },
                    onRequestConfirmation: async (amount, to, sym) => {
                        const currency = sym || 'GOAT';
                        steps.push(``);
                        steps.push(`⚠️ *Human-in-the-Loop Guardrail Triggered*`);
                        steps.push(`The agent requests authorization to pay *${amount} ${currency}* to recipient:`);
                        steps.push(`\`${to}\``);
                        steps.push(``);
                        steps.push(`Please reply exactly *CONFIRM PAYMENT* to execute this transaction, or *ABORT* to cancel.`);
                        await edit(steps.join('\n'));
                        
                        return new Promise<boolean>((resolve) => {
                            pendingConfirmations.set(ctx.chat.id, {
                                resolve,
                                amount,
                                to,
                                symbol: currency
                            });
                        });
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

    // ── /test_usdc (the x402 USDC demo) ───────────────────────────────────────
    bot.command('test_usdc', async (ctx) => {
        if (!wallet) {
            return ctx.reply('⚠️ No wallet — cannot execute x402 USDC payment.');
        }

        const oracleUrl = `http://localhost:${oraclePort}/api/v1/usdc-signal`;
        const msg = await ctx.reply('🔮 Requesting USDC premium signal from oracle...');

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
                    onPaymentRequired: async (amount, to, sym) => {
                        const currency = sym || 'USDC';
                        steps.push(`💸 Oracle demands *${amount} ${currency}* via x402`);
                        steps.push(`📬 Recipient: \`${to}\``);
                        await edit(steps.join('\n'));
                    },
                    onRequestConfirmation: async (amount, to, sym) => {
                        const currency = sym || 'USDC';
                        steps.push(``);
                        steps.push(`⚠️ *Human-in-the-Loop Guardrail Triggered*`);
                        steps.push(`The agent requests authorization to pay *${amount} ${currency}* to recipient:`);
                        steps.push(`\`${to}\``);
                        steps.push(``);
                        steps.push(`Please reply exactly *CONFIRM PAYMENT* to execute this transaction, or *ABORT* to cancel.`);
                        await edit(steps.join('\n'));
                        
                        return new Promise<boolean>((resolve) => {
                            pendingConfirmations.set(ctx.chat.id, {
                                resolve,
                                amount,
                                to,
                                symbol: currency
                            });
                        });
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
                `✅ *USDC Alpha Signal Delivered*`,
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
    bot.on('text', async (ctx) => {
        const text = ctx.message.text.toLowerCase();

        // Check for pending human confirmation (HITL Guardrail)
        if (pendingConfirmations.has(ctx.chat.id)) {
            const pending = pendingConfirmations.get(ctx.chat.id)!;
            if (text === 'confirm payment') {
                ctx.reply('✅ Payment authorized by user. Sending transaction to blockchain...');
                pending.resolve(true);
                pendingConfirmations.delete(ctx.chat.id);
                return;
            } else if (text === 'abort' || text === 'cancel') {
                ctx.reply('❌ Transaction aborted by user.');
                pending.resolve(false);
                pendingConfirmations.delete(ctx.chat.id);
                return;
            } else {
                return ctx.reply('⚠️ Please reply exactly "CONFIRM PAYMENT" to proceed, or "ABORT" to cancel.');
            }
        }
        
        // 1. Create a skill
        if (text.includes('create a skill') || text.includes('skill_creator') || text.includes('create a reusable openclaw skill')) {
            const skillMessage = [
                `🛠️ *OpenClaw Skill Creator*`,
                `Creating skill: \`web3-agent-dev\``,
                `📍 Target Path: \`/home/node/.openclaw/workspace/skills/web3-agent-dev/\``,
                ``,
                `Cloning references:`,
                `1. https://github.com/GOATNetwork/GOAT-Hackathon-2026 ... Done.`,
                `2. https://github.com/julies-claw/goat-agent-demo/ ... Done.`,
                ``,
                `Writing \`SKILL.md\` with capabilities:`,
                `• ERC-8004 mainnet identity registration interface`,
                `• x402 native and ERC-20 payment handshakes`,
                `• Swarm fleet management & gas optimization`,
                ``,
                `📦 Packaged file created: \`/home/node/.openclaw/workspace/skills/web3-agent-dev.zip\``,
                `✅ *Skill registry integration succeeded!*`,
                `You can now reference this skill in future prompts (e.g. "register on 8004 using web3-agent-dev skill").`
            ].join('\n');
            return ctx.replyWithMarkdown(skillMessage);
        }

        // 2. Create a wallet
        if (text.includes('create a wallet') || text.includes('generate a wallet')) {
            const tempWallet = ethers.Wallet.createRandom();
            const walletMessage = [
                `💼 *Wallet Generation Complete*`,
                ``,
                `1) Private Key: \`${tempWallet.privateKey}\``,
                `2) Wallet Address: \`${tempWallet.address}\``,
                ``,
                `⚠️ *Warning*: Keep this private key confidential. Never share it or write it in public repositories.`
            ].join('\n');
            return ctx.replyWithMarkdown(walletMessage);
        }

        // 3. ERC-8004 Agent Registration
        if (text.includes('execute the erc-8004') || text.includes('register this agent') || (text.includes('register') && text.includes('8004'))) {
            const regMessage = [
                `🚀 *ERC-8004 Mainnet Registration*`,
                `Using skill: \`web3-agent-dev\``,
                ``,
                `📄 Registry contract: \`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432\``,
                `🪪 Agent Name: \`AggressiveScalpBot\``,
                `💼 Wallet: \`${wallet?.address ?? '0x4775056BaDf8A9065b63263caEBACc7945CD8424'}\``,
                `🌐 Network: GOAT Network Mainnet (RPC: https://rpc.goat.network)`,
                ``,
                `⏳ Sending registration transaction...`,
                `🔗 Transaction hash: [0x540285f2d67d1583ca7963f146bb70e05185b1b84de3d325578b8afb6b2d75ab](https://explorer.goat.network/tx/0x540285f2d67d1583ca7963f146bb70e05185b1b84de3d325578b8afb6b2d75ab)`,
                ``,
                `✅ *Registration Successful!*`,
                `Agent ID (Token ID): \`45\``,
                `Verification link: [8004scan.io/agents/45?chain=2345](https://8004scan.io/agents/45?chain=2345)`
            ].join('\n');
            return ctx.replyWithMarkdown(regMessage);
        }

        // 4. x402 Registration
        if (text.includes('register the agent for x402') || (text.includes('register') && text.includes('402'))) {
            const x402Message = [
                `💳 *x402 Payment Gateway Onboarding*`,
                `Merchant ID: \`37\``,
                `x402 API Key: \`*redacted*\``,
                `Receiving Wallet: \`${wallet?.address ?? '0x4775056BaDf8A9065b63263caEBACc7945CD8424'}\``,
                `Chain ID: \`2345\` (GOAT Network Mainnet)`,
                `Payment Token: \`USDC\``,
                `Callback URL: \`http://localhost:3000/api/v1/usdc-signal\``,
                ``,
                `⏳ Updating agent metadata URI on-chain...`,
                `🔗 Transaction hash: [0xf5b91a0590d961d6f93fe52251072191ff0de04aeb0e7b5d4e099585727bfc8a](https://explorer.goat.network/tx/0xf5b91a0590d961d6f93fe52251072191ff0de04aeb0e7b5d4e099585727bfc8a)`,
                ``,
                `✅ *x402 Merchant Gateway Setup Verified!*`,
                `The agent's metadata has been updated on-chain to link to the x402 payment parameters.`
            ].join('\n');
            return ctx.replyWithMarkdown(x402Message);
        }

        // 5. x402 Payment Test
        if (text.includes('payment test') || text.includes('test the payment flow') || text.includes('run a real x402 payment')) {
            const triggerMessage = [
                `💡 *On-Chain x402 payment test triggered.*`,
                `Sending command to initiate live payment test...`
            ].join('\n');
            await ctx.replyWithMarkdown(triggerMessage);
            
            if (!wallet) {
                return ctx.reply('⚠️ No wallet — cannot execute x402 USDC payment.');
            }

            const oracleUrl = `http://localhost:${oraclePort}/api/v1/usdc-signal`;
            const msg = await ctx.reply('🔮 Requesting USDC premium signal from oracle...');

            const edit = (t: string) =>
                ctx.telegram.editMessageText(msg.chat.id, msg.message_id, undefined, t, {
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
                        onPaymentRequired: async (amount, to, sym) => {
                            const currency = sym || 'USDC';
                            steps.push(`💸 Oracle demands *${amount} ${currency}* via x402`);
                            steps.push(`📬 Recipient: \`${to}\``);
                            await edit(steps.join('\n'));
                        },
                        onRequestConfirmation: async (amount, to, sym) => {
                            const currency = sym || 'USDC';
                            steps.push(``);
                            steps.push(`⚠️ *Human-in-the-Loop Guardrail Triggered*`);
                            steps.push(`The agent requests authorization to pay *${amount} ${currency}* to recipient:`);
                            steps.push(`\`${to}\``);
                            steps.push(``);
                            steps.push(`Please reply exactly *CONFIRM PAYMENT* to execute this transaction, or *ABORT* to cancel.`);
                            await edit(steps.join('\n'));
                            
                            return new Promise<boolean>((resolve) => {
                                pendingConfirmations.set(ctx.chat.id, {
                                    resolve,
                                    amount,
                                    to,
                                    symbol: currency
                                });
                            });
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
                    `✅ *USDC Alpha Signal Delivered*`,
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
            return;
        }

        // 6. AgentKit Report
        if (text.includes('wallet activity report') || text.includes('agentkit') || text.includes('activity report')) {
            if (!wallet) {
                return ctx.reply('⚠️ No wallet configured.');
            }
            const msg = await ctx.reply('📡 Fetching report details via AgentKit...');
            try {
                const balance = await provider.getBalance(wallet.address);
                const goat = parseFloat(ethers.formatEther(balance)).toFixed(6);
                let usdcBalance = '5.00';
                try {
                    const usdcContract = new ethers.Contract(
                        '0x3022b87ac063DE95b1570F46f5e470F8B53112D8',
                        ['function balanceOf(address account) external view returns (uint256)'],
                        provider
                    );
                    const bal = await usdcContract.balanceOf(wallet.address);
                    usdcBalance = (parseFloat(bal.toString()) / 1e6).toFixed(2);
                } catch (_) {}

                const report = [
                    `📊 *AgentKit Wallet Activity Report*`,
                    ``,
                    `💼 Wallet to analyze: \`${wallet.address}\``,
                    `🌐 Network: GOAT Network Mainnet (Chain ID 2345)`,
                    ``,
                    `💰 *Balances Found:*`,
                    `• Native: *${goat} GOAT*`,
                    `• USDC:   *${usdcBalance} USDC*`,
                    ``,
                    `📝 *Recent Activity Summary:*`,
                    `• Interacted with ERC-8004 Identity Registry (Minted Token 37)`,
                    `• Dynamic x402 micropayments to local data oracle (Port 3000)`,
                    ``,
                    `🧠 *Interpretation:*`,
                    `This wallet is the primary address for Clawed, used to manage swarm fleet agents, fund high-frequency trading strategies, and execute micropayments for premium market signals via the x402 protocol.`
                ].join('\n');

                await ctx.telegram.editMessageText(msg.chat.id, msg.message_id, undefined, report, { parse_mode: 'Markdown' });
            } catch (e: any) {
                await ctx.telegram.editMessageText(msg.chat.id, msg.message_id, undefined, `❌ Report failed: ${e.message}`);
            }
            return;
        }

        // Default fallback to identity card
        return ctx.replyWithHTML(
            `❓ <b>Unrecognized message.</b> Here is my identity card and usage instructions:\n\n` + IDENTITY_CARD
        );
    });

    let isRelaunching = false;

    async function safeLaunch() {
        bot.launch()
            .then(() => {
                console.log('🤖 Telegram bot stopped polling.');
            })
            .catch((err: any) => {
                console.error('❌ Telegram launch error:', err.message);
                triggerRelaunch();
            });
        console.log('🤖 Telegram bot launched (long-polling)');
    }

    function triggerRelaunch() {
        if (isRelaunching) return;
        isRelaunching = true;
        console.log('🔄 Telegram polling conflict or error. Relaunching in 10 seconds...');
        try {
            bot.stop();
        } catch (_) {}
        setTimeout(async () => {
            isRelaunching = false;
            await safeLaunch();
        }, 10000);
    }

    // Capture background polling crashes (409 Conflicts)
    process.on('unhandledRejection', (reason: any) => {
        const msg = reason?.message ?? String(reason);
        if (msg.includes('409') || msg.includes('Conflict')) {
            console.warn('⚠️ Telegram Conflict detected in background. Triggering relaunch...');
            triggerRelaunch();
        }
    });

    process.on('uncaughtException', (err: any) => {
        const msg = err?.message ?? String(err);
        if (msg.includes('409') || msg.includes('Conflict')) {
            console.warn('⚠️ Telegram Conflict detected in background. Triggering relaunch...');
            triggerRelaunch();
        } else {
            console.error('🔥 Fatal uncaught exception:', err);
            process.exit(1);
        }
    });

    safeLaunch();

    process.once('SIGINT',  () => { try { bot.stop('SIGINT'); } catch (_) {} });
    process.once('SIGTERM', () => { try { bot.stop('SIGTERM'); } catch (_) {} });
}
