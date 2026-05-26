import { ethers } from 'ethers';

const REGISTRY_ADDRESS = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';
const RPC_URL = 'https://rpc.goat.network';
const OWNER_ADDRESS = '0x4775056BaDf8A9065b63263caEBACc7945CD8424';

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const registry = new ethers.Contract(
        REGISTRY_ADDRESS,
        [
            'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
        ],
        provider
    );

    try {
        console.log("Searching for Transfer events...");
        const filter = registry.filters.Transfer(null, OWNER_ADDRESS);
        const events = await registry.queryFilter(filter, 0, 'latest');
        
        console.log(`Found ${events.length} Transfer events:`);
        for (const event of events) {
            console.log(`- Token ID: ${event.args.tokenId}, Tx Hash: ${event.transactionHash}`);
        }
    } catch (e) {
        console.error("Error querying events:", e.message);
    }
}
main();
