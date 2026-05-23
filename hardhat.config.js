import 'dotenv/config';
import '@nomicfoundation/hardhat-toolbox';
import '@nomiclabs/hardhat-ethers';

const getAccounts = () => {
  const key = process.env.PRIVATE_KEY;
  if (!key || key.includes('YOUR_PRIVATE_KEY') || key.trim() === '') {
    return [];
  }
  return [key];
};

export default {
  solidity: "0.8.20",
  networks: {
    goatTestnet: {
      url: process.env.GOAT_RPC || "https://rpc.testnet3.goat.network",
      accounts: getAccounts()
    }
  }
};
