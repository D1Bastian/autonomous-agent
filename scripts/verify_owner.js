import { ethers } from 'ethers';

const REGISTRY_ADDRESS = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';
const RPC_URL = 'https://rpc.goat.network';
const TOKEN_ID = 37;

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const registry = new ethers.Contract(
        REGISTRY_ADDRESS,
        [
            'function ownerOf(uint256 tokenId) external view returns (address)',
            'function tokenURI(uint256 tokenId) external view returns (string)'
        ],
        provider
    );

    try {
        const owner = await registry.ownerOf(TOKEN_ID);
        console.log(`Token ID ${TOKEN_ID} owner:`, owner);
        const uri = await registry.tokenURI(TOKEN_ID);
        console.log(`Token ID ${TOKEN_ID} URI:`, uri);
    } catch (e) {
        console.error("Error querying token info:", e.message);
    }
}
main();
