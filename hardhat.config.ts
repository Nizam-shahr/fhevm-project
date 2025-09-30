import "@fhevm/hardhat-plugin";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import "@typechain/hardhat";
import "hardhat-deploy";
import "hardhat-gas-reporter";
import "solidity-coverage";
import type { HardhatUserConfig } from "hardhat/config";
import * as dotenv from "dotenv";

dotenv.config();

const MNEMONIC = process.env.MNEMONIC || "test test test test test test test test test test test junk";
const INFURA_API_KEY = process.env.INFURA_API_KEY || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const USE_FHE = process.env.USE_FHE === "true";

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  namedAccounts: {
    deployer: 0,
  },
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY,
    },
  },
  gasReporter: {
    currency: "USD",
    enabled: process.env.REPORT_GAS ? true : false,
  },
  networks: {
    hardhat: {
      accounts: {
        mnemonic: MNEMONIC,
      },
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      accounts: {
        mnemonic: MNEMONIC,
      },
      chainId: 31337,
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || `https://sepolia.infura.io/v3/${INFURA_API_KEY}`,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : { mnemonic: MNEMONIC },
      chainId: 11155111,
      timeout: 60000,
      gas: 12000000,
      gasPrice: 15000000000, // 15 gwei
    },
  },
  solidity: {
    version: "0.8.24",
    settings: {
      metadata: {
        bytecodeHash: "none",
      },
      optimizer: {
        enabled: true,
        runs: 800,
      },
      evmVersion: "cancun",
    },
  },
  typechain: {
    outDir: "types",
    target: "ethers-v6",
  },
  fhevm: {
    enabled: USE_FHE,
    networks: USE_FHE
      ? {
          sepolia: {
            enabled: true,
            executorAddress: "0x848B0066793BcC60346Da1F49049357399B8D595",
            aclAddress: "0x687820221192C5B662b25367F70076A37bc79b6c",
            decryptionOracleAddress: "0xa02Cda4Ca3a71D7C46997716F4283aa851C28812",
            relayerUrl: "https://relayer.testnet.zama.cloud",
            hcuLimitAddress: "0x594BB474275918AF9609814E68C61B1587c5F838",
            kmsVerifierAddress: "0x1364cBBf2cDF5032C47d8226a6f6FBD2AFCDacAC",
            inputVerifierAddress: "0xbc91f3daD1A5F19F8390c400196e58073B6a0BC4",
            decryptionAddress: "0xb6E160B1ff80D67Bfe90A85eE06Ce0A2613607D1",
            inputVerificationAddress: "0x7048C39f048125eDa9d678AEbaDfB22F7900a29F",
          },
        }
      : {},
  },
};

export default config;