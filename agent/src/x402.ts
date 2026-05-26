import { ethers } from 'ethers';
import { Guardrails } from './guardrails.js';

export interface X402Progress {
    onPaymentRequired?: (amount: string, to: string) => void;
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
    options: RequestInit,
    wallet: ethers.Wallet,
    guardrails?: Guardrails,
    progress?: X402Progress
): Promise<Response> {

    console.log(`🌐 Fetching ${url}...`);
    let response = await fetch(url, options);

    if (response.status === 402) {
        const authHeader = response.headers.get('Www-Authenticate');
        if (!authHeader || !authHeader.startsWith('x402')) {
            throw new Error('402 Response missing valid x402 Www-Authenticate header');
        }

        // Expected format: Www-Authenticate: x402 address="0x...", amount="1000000000000000"
        const addressMatch = authHeader.match(/address="(0x[a-fA-F0-9]+)"/);
        const amountMatch  = authHeader.match(/amount="([0-9]+)"/);

        if (!addressMatch || !amountMatch) {
            throw new Error('Invalid x402 header format');
        }

        const toAddress = addressMatch[1];
        const amountWei = amountMatch[1];
        const amountGoat = parseFloat(ethers.formatEther(amountWei));

        console.log(`💸 x402 Payment Required: ${amountGoat} GOAT → ${toAddress}`);
        progress?.onPaymentRequired?.(amountGoat.toFixed(6), toAddress);

        // Guardrail check — throws if over limit
        if (guardrails) {
            guardrails.checkAndRecord(amountGoat);
        }

        console.log(`🤖 Agent autonomously authorizing ${amountGoat} GOAT to ${toAddress}`);

        const tx = await wallet.sendTransaction({ to: toAddress, value: amountWei });

        progress?.onPaying?.(tx.hash);
        console.log(`⏳ Waiting for confirmation... Tx: ${tx.hash}`);
        await tx.wait();
        console.log(`✅ x402 Payment Confirmed! Tx Hash: ${tx.hash}`);
        progress?.onConfirmed?.(tx.hash);

        const retryOptions = {
            ...options,
            headers: {
                ...((options.headers as Record<string, string>) ?? {}),
                'Authorization': `x402 ${tx.hash}`,
            },
        };

        console.log(`🔄 Retrying request with proof of payment...`);
        response = await fetch(url, retryOptions);
    }

    return response;
}