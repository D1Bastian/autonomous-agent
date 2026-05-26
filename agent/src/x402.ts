import { ethers } from 'ethers';

/**
 * Executes a fetch request with autonomous x402 payment handling.
 * If the server responds with a 402 Payment Required, this agent will
 * parse the invoice, pay it on-chain via the GOAT network, and retry
 * the request with the transaction hash as proof of payment.
 */
export async function x402Fetch(
    url: string, 
    options: RequestInit, 
    wallet: ethers.Wallet
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
        const amountMatch = authHeader.match(/amount="([0-9]+)"/);
        
        if (!addressMatch || !amountMatch) {
            throw new Error('Invalid x402 header format');
        }
        
        const toAddress = addressMatch[1];
        const amountWei = amountMatch[1];
        const formattedAmount = ethers.formatEther(amountWei);
        
        console.log(`💸 x402 Payment Required by server.`);
        console.log(`🤖 Agent autonomously authorizing ${formattedAmount} GOAT to ${toAddress}`);
        
        // Execute the micro-transaction
        const tx = await wallet.sendTransaction({
            to: toAddress,
            value: amountWei
        });
        
        console.log(`⏳ Waiting for block confirmation...`);
        await tx.wait();
        console.log(`✅ x402 Payment Confirmed! Tx Hash: ${tx.hash}`);
        
        // Retry the request with the proof of payment
        const retryOptions = {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': `x402 ${tx.hash}` // Supplying the TxHash as proof
            }
        };
        
        console.log(`🔄 Retrying request with proof of payment...`);
        response = await fetch(url, retryOptions);
    }
    
    return response;
}