import * as http from 'http';
import { ethers } from 'ethers';

export class OracleServer {
    private server: http.Server;
    private provider: ethers.Provider;
    private oracleWalletAddress: string;
    private pricePerRequest: bigint;

    constructor(provider: ethers.Provider, oracleWalletAddress: string, priceInGoat: string) {
        this.provider = provider;
        this.oracleWalletAddress = oracleWalletAddress;
        this.pricePerRequest = ethers.parseEther(priceInGoat);
        
        this.server = http.createServer(this.handleRequest.bind(this));
    }

    private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        if (req.url === '/api/v1/alpha-signal' && req.method === 'GET') {
            const authHeader = req.headers['authorization'];
            
            // If no valid x402 header is provided, demand payment (HTTP 402)
            if (!authHeader || !authHeader.startsWith('x402 ')) {
                res.writeHead(402, { 
                    'Content-Type': 'application/json',
                    'Www-Authenticate': `x402 address="${this.oracleWalletAddress}", amount="${this.pricePerRequest.toString()}"` 
                });
                res.end(JSON.stringify({ 
                    error: "Payment Required.", 
                    message: "Please pay the required GOAT amount and submit the transaction hash via the Authorization header (e.g. 'Authorization: x402 0x...')."
                }));
                return;
            }

            const txHash = authHeader.split(' ')[1];
            
            try {
                // Verify the payment transaction on the GOAT Network
                console.log(`🔮 Oracle: Verifying incoming payment tx: ${txHash}`);
                const tx = await this.provider.getTransaction(txHash);
                
                if (!tx) throw new Error("Transaction not found on GOAT network.");
                if (tx.to?.toLowerCase() !== this.oracleWalletAddress.toLowerCase()) {
                    throw new Error("Transaction recipient is not the Oracle wallet.");
                }
                if (tx.value < this.pricePerRequest) {
                    throw new Error(`Insufficient payment amount. Expected ${this.pricePerRequest.toString()} wei.`);
                }
                
                // TODO: In a production environment, cache the txHash to prevent replay attacks!

                // Payment verified! Serve the premium Alpha Signal data
                const premiumData = {
                    asset: "BTC/GOAT",
                    signal: "STRONG_BUY",
                    confidence: 0.94,
                    target: 69420.00,
                    timestamp: new Date().toISOString(),
                    paidVia: txHash
                };
                
                console.log(`🔮 Oracle: Payment verified. Delivering alpha signal to client.`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(premiumData));

            } catch (e: any) {
                console.error(`🔮 Oracle Error: ${e.message}`);
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: "Invalid payment", details: e.message }));
            }
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: "Endpoint Not Found" }));
        }
    }

    public start(port: number) {
        this.server.listen(port, () => {
            console.log(`🔮 Oracle x402 Server listening on HTTP port ${port}`);
        });
    }
}
