import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";

dotenv.config();

const mainnet_url = process.env.MAINNET_RPC_URL!;
const testnet_url = process.env.TESTNET_RPC_URL!;
const private_key = process.env.PRIVATE_KEY!;

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      { version: "0.8.28" },
      { version: "0.8.29" }
    ],
    
  },

  networks: {

    hardhat: {
      forking: {
        url: mainnet_url,
        // optional:
        // blockNumber: 38000000,
      }
    },

    localhost: {
      url: "http://127.0.0.1:8545/"
    },

    BSCtestnet: {
      url: testnet_url,
      chainId: 97,
      accounts: [private_key],
    },

    BSCmainnet: {
      url: mainnet_url,
      chainId: 56,
      accounts: [private_key],
    },
  },
};

export default config;