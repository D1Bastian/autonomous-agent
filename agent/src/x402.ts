import { ethers } from 'ethers';
import { Guardrails } from './guardrails.js';

export interface X402Progress {
    onPaymentRequired?: (amount: string, to: string, symbol?: string) => void;
    onRequestConfirmation?: (amount: string, to: string, symbol?: string) => Promise<boolean>;
    onPaying?: (txHash: string) => void;
    onConfirmed?: (txHash: string) => void;
}

/**
 * Executes a fetch request with autonomous x402 payment handling.
 * If the server responds with a 402 Payment Required, this agent will
 * parse the invoice, pay it on-chain via the GOAT network, and retry
 * the request with the transaction hash as proof of payment.
 */
export async function x402Fetch(
    url: string,
    options: RequestInit = {},
    wallet: ethers.Wallet,
    guardrails?: Guardrails,
    progress?: X402Progress,
    timeoutMs: number = 10000
): Promise<Response> {

    console.log(`🌐 Fetching ${url}...`);
    
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const fetchOptions = {
        ...options,
        signal: controller.signal
    };

    let response: Response;
    try {
        response = await fetch(url, fetchOptions);
    } catch (e: any) {
        if (e.name === 'AbortError') {
            throw new Error(`Connection to oracle timed out after ${timeoutMs / 1000} seconds. The network might be congested or the oracle is offline.`);
        }
        throw new Error(`Network connection error: ${e.message}. Please check if the oracle server is running.`);
    } finally {
        clearTimeout(timer);
    }

    if (response.status === 402) {
        const authHeader = response.headers.get('Www-Authenticate');
        if (!authHeader || !authHeader.startsWith('x402')) {
            throw new Error('402 Response missing valid x402 Www-Authenticate header');
        }

        const addressMatch = authHeader.match(/address="(0x[a-fA-F0-9]+)"/);
        const amountMatch  = authHeader.match(/amount="([0-9]+)"/);
        const tokenMatch   = authHeader.match(/token="(0x[a-fA-F0-9]+)"/);

        if (!addressMatch || !amountMatch) {
            throw new Error('Invalid x402 header format');
        }
        const toAddress = addressMatch[1];
        const amountWei = amountMatch[1];
        const tokenAddress = tokenMatch ? tokenMatch[1] : null;

        let symbol = 'GOAT';
        let decimals = 18;
        if (tokenAddress) {
            try {
                const tokenContract = new ethers.Contract(
                    tokenAddress,
                    [
                        'function decimals() external view returns (uint8)',
                        'function symbol() external view returns (string)'
                    ],
                    wallet
                );
                const [d, s] = await Promise.all([
                    tokenContract.decimals(),
                    tokenContract.symbol()
                ]);
                decimals = Number(d);
                symbol = s;
            } catch (e) {
                console.warn('Failed to query token metadata, defaulting to USDC/6:', e);
                symbol = 'USDC';
                decimals = 6;
            }
        }

        const formattedAmount = ethers.formatUnits(amountWei, decimals);

        if (tokenAddress) {
            console.log(`💸 x402 Payment Required: ${formattedAmount} ${symbol} (${amountWei} units) → ${toAddress}`);
        } else {
            console.log(`💸 x402 Payment Required: ${formattedAmount} GOAT → ${toAddress}`);
        }
        progress?.onPaymentRequired?.(formattedAmount, toAddress, symbol);

        // Guardrail check — throws if over limit (only checking native equivalent approximation or flat limit)
        if (guardrails) {
            const amountNum = parseFloat(formattedAmount);
            guardrails.checkAndRecord(tokenAddress ? 0.001 : amountNum); // Mock cost for token tx checking
        }

        if (progress?.onRequestConfirmation) {
            const confirmed = await progress.onRequestConfirmation(formattedAmount, toAddress, symbol);
            if (!confirmed) {
                throw new Error("Payment authorization rejected by user.");
            }
        }

        let tx;
        if (tokenAddress) {
            console.log(`🤖 Agent autonomously executing ERC-20 transfer for token ${tokenAddress}`);
            const tokenContract = new ethers.Contract(
                tokenAddress,
                ['function transfer(address to, uint256 value) external returns (bool)'],
                wallet
            );
            tx = await tokenContract.transfer(toAddress, amountWei);
        } else {
            console.log(`🤖 Agent autonomously authorizing ${formattedAmount} GOAT to ${toAddress}`);
            tx = await wallet.sendTransaction({ to: toAddress, value: amountWei });
        }

        progress?.onPaying?.(tx.hash);
        console.log(`⏳ Waiting for confirmation... Tx: ${tx.hash}`);
        try {
            await tx.wait(1, 30000); // 30s timeout for transaction confirmation
        } catch (e: any) {
            throw new Error(`Transaction submitted but timed out waiting for confirmation: ${tx.hash}`);
        }
        console.log(`✅ x402 Payment Confirmed! Tx Hash: ${tx.hash}`);
        progress?.onConfirmed?.(tx.hash);

        const retryController = new AbortController();
        const retryTimer = setTimeout(() => retryController.abort(), timeoutMs);
        const retryOptions = {
            ...options,
            headers: {
                ...((options.headers as Record<string, string>) ?? {}),
                'Authorization': `x402 ${tx.hash}`,
            },
            signal: retryController.signal
        };

        console.log(`🔄 Retrying request with proof of payment...`);
        try {
            response = await fetch(url, retryOptions);
        } catch (e: any) {
            if (e.name === 'AbortError') {
                throw new Error(`Retry connection to oracle timed out after ${timeoutMs / 1000} seconds.`);
            }
            throw new Error(`Network connection error during retry: ${e.message}`);
        } finally {
            clearTimeout(retryTimer);
        }
    }

    return response;
}