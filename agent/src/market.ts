export interface PriceData {
    asset: string;
    id: string;
    priceUsd: number;
    change24h: number;
    signal: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
}

function toSignal(change: number): PriceData['signal'] {
    if (change > 5)  return 'STRONG_BUY';
    if (change > 1)  return 'BUY';
    if (change > -1) return 'HOLD';
    if (change > -5) return 'SELL';
    return 'STRONG_SELL';
}

const DISPLAY_NAME: Record<string, string> = {
    bitcoin:  'BTC',
    ethereum: 'ETH',
    'bitcoin-cash': 'BCH',
};

const COIN_GECKO_IDS: Record<string, string> = {
    btc: 'bitcoin',
    eth: 'ethereum',
    bch: 'bitcoin-cash',
    bitcoin:  'bitcoin',
    ethereum: 'ethereum',
};

export function resolveId(input: string): string {
    const lower = input.toLowerCase().trim();
    return COIN_GECKO_IDS[lower] ?? lower;
}

export async function fetchPrices(coinIds: string[] = ['bitcoin', 'ethereum']): Promise<PriceData[]> {
    const ids = coinIds.join(',');
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`CoinGecko API error: ${res.status}`);

    const raw = await res.json() as Record<string, { usd: number; usd_24h_change: number }>;

    return coinIds.map(id => {
        const entry = raw[id];
        const change = entry?.usd_24h_change ?? 0;
        return {
            asset:    DISPLAY_NAME[id] ?? id.toUpperCase(),
            id,
            priceUsd: entry?.usd ?? 0,
            change24h: parseFloat(change.toFixed(2)),
            signal:   toSignal(change),
        };
    });
}

export function signalEmoji(signal: PriceData['signal']): string {
    const map: Record<PriceData['signal'], string> = {
        STRONG_BUY:  '🚀',
        BUY:         '📈',
        HOLD:        '⏸',
        SELL:        '📉',
        STRONG_SELL: '🔻',
    };
    return map[signal];
}
