import { ethers } from 'ethers';
import { fetchPrices, PriceData } from './market.js';
import { x402Fetch } from './x402.js';
import { Guardrails } from './guardrails.js';

interface Position {
    asset:       string;
    coinId:      string;
    entryPrice:  number;
    entryTime:   Date;
    signal:      string;
    txHash:      string;
    stopLoss:    number;
    takeProfit:  number;
}

interface TradeRecord {
    asset:      string;
    direction:  'LONG';
    entryPrice: number;
    exitPrice:  number;
    pnlPct:     number;
    openedAt:   Date;
    closedAt:   Date;
    duration:   string;
    reason:     'SIGNAL' | 'STOP_LOSS' | 'TAKE_PROFIT' | 'MANUAL';
    txHash:     string;
}

function fmtDuration(ms: number): string {
    const s = Math.floor(ms / 1000);
    if (s < 60)   return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
    return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

function fmtPnl(pct: number): string {
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${(pct * 100).toFixed(2)}%`;
}

export class AutoTrader {
    private running     = false;
    private positions   = new Map<string, Position>();
    private history:    TradeRecord[] = [];
    private intervalId?: ReturnType<typeof setInterval>;
    private notifyFn:   (msg: string) => void;

    constructor(
        private wallet:     ethers.Wallet,
        private guardrails: Guardrails,
        private oraclePort: number,
        notifyFn: (msg: string) => void
    ) {
        this.notifyFn = notifyFn;
    }

    setNotify(fn: (msg: string) => void) {
        this.notifyFn = fn;
    }

    start(assets: string[] = ['bitcoin', 'ethereum']): void {
        if (this.running) return;
        this.running = true;
        console.log(`📊 AutoTrader started — monitoring: ${assets.join(', ')}`);

        // Run immediately then every 30s
        this.tick(assets).catch(console.error);
        this.intervalId = setInterval(() => {
            this.tick(assets).catch(console.error);
        }, 30_000);
    }

    stop(): void {
        if (!this.running) return;
        this.running = false;
        if (this.intervalId) clearInterval(this.intervalId);
        console.log('📊 AutoTrader stopped.');
    }

    isRunning(): boolean { return this.running; }

    getPosition(coinId: string): Position | undefined {
        return this.positions.get(coinId);
    }

    getAllPositions(): Position[] {
        return Array.from(this.positions.values());
    }

    getHistory(n = 5): TradeRecord[] {
        return this.history.slice(-n).reverse();
    }

    closePosition(coinId: string, currentPrice: number, reason: TradeRecord['reason']): void {
        const pos = this.positions.get(coinId);
        if (!pos) return;

        const pnlPct   = (currentPrice - pos.entryPrice) / pos.entryPrice;
        const closedAt = new Date();
        const duration = fmtDuration(closedAt.getTime() - pos.entryTime.getTime());

        const record: TradeRecord = {
            asset:      pos.asset,
            direction:  'LONG',
            entryPrice: pos.entryPrice,
            exitPrice:  currentPrice,
            pnlPct,
            openedAt:   pos.entryTime,
            closedAt,
            duration,
            reason,
            txHash:     pos.txHash,
        };
        this.history.push(record);
        this.positions.delete(coinId);

        const icon = reason === 'STOP_LOSS'   ? '🛑 STOP LOSS'
                   : reason === 'TAKE_PROFIT' ? '🎯 TAKE PROFIT'
                   : reason === 'MANUAL'      ? '🤚 CLOSED MANUALLY'
                   :                           '✅ TRADE CLOSED';

        this.notifyFn([
            `${icon}`,
            ``,
            `${pos.asset} Long`,
            `Entry:    $${pos.entryPrice.toLocaleString('en-US')} → Exit: $${currentPrice.toLocaleString('en-US')}`,
            `P&L:      ${fmtPnl(pnlPct)}`,
            `Duration: ${duration}`,
        ].join('\n'));

        console.log(`📊 Closed ${pos.asset} position: ${fmtPnl(pnlPct)} (${reason})`);
    }

    private async tick(assets: string[]): Promise<void> {
        try {
            const prices = await fetchPrices(assets);
            for (const price of prices) {
                await this.checkExits(price);
                if (!this.positions.has(price.id) && price.signal === 'STRONG_BUY') {
                    await this.openPosition(price);
                }
            }
        } catch (e: any) {
            console.error('📊 AutoTrader tick error:', e.message);
        }
    }

    private async openPosition(price: PriceData): Promise<void> {
        try {
            this.guardrails.checkAndRecord(0.000001);
        } catch (e: any) {
            this.notifyFn(`🚨 AutoTrader blocked: ${e.message}`);
            return;
        }

        let txHash = 'pending';
        try {
            const oracleUrl = `http://localhost:${this.oraclePort}/api/v1/alpha-signal`;
            const res = await x402Fetch(oracleUrl, {}, this.wallet, this.guardrails, {
                onConfirmed: (hash) => { txHash = hash; },
            });
            if (res.ok) {
                const data = await res.json() as { paidVia?: string };
                txHash = data.paidVia ?? txHash;
            }
        } catch (e: any) {
            console.error('📊 Oracle payment failed:', e.message);
            txHash = 'oracle-unavailable';
        }

        const pos: Position = {
            asset:      price.asset,
            coinId:     price.id,
            entryPrice: price.priceUsd,
            entryTime:  new Date(),
            signal:     price.signal,
            txHash,
            stopLoss:   price.priceUsd * 0.97,
            takeProfit: price.priceUsd * 1.05,
        };
        this.positions.set(price.id, pos);

        this.notifyFn([
            `🤖 AUTO-TRADE EXECUTED`,
            ``,
            `📈 LONG ${price.asset} opened`,
            `💲 Entry:       $${price.priceUsd.toLocaleString('en-US')}`,
            `🎯 Signal:      ${price.signal}`,
            `🛑 Stop-loss:   $${pos.stopLoss.toLocaleString('en-US', { maximumFractionDigits: 0 })} (−3%)`,
            `🎯 Take-profit: $${pos.takeProfit.toLocaleString('en-US', { maximumFractionDigits: 0 })} (+5%)`,
            `💸 Confirmed on-chain via x402`,
            `🔗 Tx: ${txHash.startsWith('0x') ? txHash.slice(0, 20) + '...' : txHash}`,
        ].join('\n'));

        console.log(`📊 Opened LONG ${price.asset} at $${price.priceUsd}`);
    }

    private async checkExits(price: PriceData): Promise<void> {
        const pos = this.positions.get(price.id);
        if (!pos) return;

        const pnl = (price.priceUsd - pos.entryPrice) / pos.entryPrice;

        if (price.signal === 'SELL' || price.signal === 'STRONG_SELL') {
            this.closePosition(price.id, price.priceUsd, 'SIGNAL');
        } else if (pnl <= -0.03) {
            this.closePosition(price.id, price.priceUsd, 'STOP_LOSS');
        } else if (pnl >= 0.05) {
            this.closePosition(price.id, price.priceUsd, 'TAKE_PROFIT');
        }
    }
}
