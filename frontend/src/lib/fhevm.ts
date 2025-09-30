"use client";

import { ethers } from "ethers";

// Singleton SDK instance
let sdkInstance: any | null = null;

// Contract address (from .env or fallback)
export const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  "0x807bE6b98BD9B2edE0658033bcaD0C37923d1051";

// ABI for ConfidentialVotingAutoRegister contract
export const CONTRACT_ABI = [
  // Constructor
  {
    inputs: [{ internalType: "uint256", name: "durationInSeconds", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  // View functions
  {
    inputs: [],
    name: "admin",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "initialized",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "votingEndTime",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "isRegistered",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "hasVoted",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  // Write functions
  {
    inputs: [],
    name: "init",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "bytes", name: "voteHandle", type: "bytes" },
      { internalType: "bytes", name: "weightHandle", type: "bytes" },
      { internalType: "bytes", name: "attestation", type: "bytes" },
      { internalType: "bytes", name: "extraData", type: "bytes" },
    ],
    name: "castVote",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "makeTallyPublic",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "getEncryptedTally",
    outputs: [
      { internalType: "bytes32", name: "yesHandle", type: "bytes32" },
      { internalType: "bytes32", name: "noHandle", type: "bytes32" },
    ],
    stateMutability: "view",
    type: "function",
  },
];

// -------------------------------------------------------------------
// Contract utilities
// -------------------------------------------------------------------
export async function checkContractConnection(contract: ethers.Contract): Promise<boolean> {
  try {
    console.log("🔍 Checking contract connection...");
    
    // First check if contract is deployed by getting code
    const provider = contract.runner?.provider;
    if (!provider) {
      console.error("❌ No provider available");
      return false;
    }

    const code = await provider.getCode(contract.target);
    console.log("📄 Contract code length:", code.length);
    
    if (code === "0x") {
      console.error("❌ No contract deployed at:", contract.target);
      return false;
    }

    // Test a simple view function
    try {
      const votingEndTime = await contract.votingEndTime();
      console.log("✅ Contract connection verified - votingEndTime:", votingEndTime.toString());
      return true;
    } catch (viewError) {
      console.error("❌ Contract view function failed:", viewError);
      // Even if view functions fail, the contract might still be deployed
      // Return true if code exists
      return code !== "0x";
    }
  } catch (error) {
    console.error("❌ Contract connection check failed:", error);
    return false;
  }
}

export async function verifyContractReadiness(contract: ethers.Contract): Promise<boolean> {
  try {
    console.log("🔍 Verifying contract readiness...");
    
    // Test basic functions with error handling
    const [votingEndTime, initialized] = await Promise.all([
      contract.votingEndTime().catch(() => null),
      contract.initialized().catch(() => null),
    ]);
    
    console.log("✅ Contract readiness:", { 
      votingEndTime: votingEndTime ? votingEndTime.toString() : 'N/A',
      initialized: initialized !== null ? initialized : 'N/A'
    });
    
    // Consider contract ready if we can call at least one function
    return votingEndTime !== null || initialized !== null;
  } catch (error) {
    console.error("❌ Contract readiness check failed:", error);
    return false;
  }
}

export async function debugContractState(contract: ethers.Contract, userAddress: string) {
  try {
    console.log("🔍 Debugging contract state for:", userAddress);
    
    // Only call functions that definitely exist with error handling
    const [votingEndTime, initialized, hasVoted, isRegistered] = await Promise.all([
      contract.votingEndTime().catch(() => 0),
      contract.initialized().catch(() => false),
      contract.hasVoted(userAddress).catch(() => false),
      contract.isRegistered(userAddress).catch(() => false),
    ]);
    
    const state = {
      votingEndTime: Number(votingEndTime),
      initialized,
      hasVoted,
      isRegistered,
      currentTime: Math.floor(Date.now() / 1000),
      votingOpen: Number(votingEndTime) > Math.floor(Date.now() / 1000)
    };
    
    console.log("🔍 Contract debug state:", state);
    return state;
  } catch (error) {
    console.error("❌ Debug contract state failed:", error);
    return null;
  }
}

// Check contract deployment status
export async function checkContractDeployment(provider: ethers.BrowserProvider | undefined): Promise<boolean> {
  try {
    console.log("🔍 Checking contract deployment at:", CONTRACT_ADDRESS);
    
    let rpcProvider;
    
    if (provider) {
      rpcProvider = provider;
    } else {
      // Fallback to public RPC
      rpcProvider = new ethers.JsonRpcProvider("https://sepolia.infura.io/v3/6cda751cff9c4df28da192cd0c082d9a");
    }
    
    const code = await rpcProvider.getCode(CONTRACT_ADDRESS);
    const deployed = code !== "0x";
    
    console.log("✅ Contract deployment check:", deployed ? "✅ Deployed" : "❌ Not deployed");
    console.log("📄 Contract code length:", code.length);
    
    return deployed;
  } catch (err) {
    console.error("❌ Failed to check contract deployment:", err);
    return false;
  }
}

// -------------------------------------------------------------------
// SDK Setup
// -------------------------------------------------------------------
export async function initializeSDK(): Promise<any> {
  if (typeof window === "undefined") throw new Error("FHEVM SDK must run in the browser");
  if (sdkInstance) return sdkInstance;

  // Wait for SDK to load
  if (!(window as any).RelaySDK) {
    console.log("🔄 Waiting for Relay SDK to load...");
    await new Promise((resolve, reject) => {
      const checkSDK = () => {
        if ((window as any).RelaySDK) {
          resolve(true);
        } else {
          setTimeout(checkSDK, 100);
        }
      };
      setTimeout(() => reject(new Error("Relay SDK loading timeout")), 10000);
      checkSDK();
    });
  }

  const { initSDK, createInstance, SepoliaConfig } = (window as any).RelaySDK;

  try {
    console.log("🔄 Initializing FHEVM WASM...");
    await initSDK();
    console.log("✅ FHEVM WASM loaded successfully");
  } catch (err) {
    console.error("❌ Failed to load FHEVM WASM:", err);
    throw new Error("FHEVM WASM initialization failed");
  }

  const config = {
    ...SepoliaConfig,
    network: (window as any).ethereum,
    relayerUrl: process.env.NEXT_PUBLIC_RELAYER_URL || "https://relayer.testnet.zama.cloud",
    executorAddress: process.env.NEXT_PUBLIC_EXECUTOR_ADDRESS || "0x848B0066793BcC60346Da1F49049357399B8D595",
  };

  try {
    sdkInstance = await createInstance(config);
    console.log("✅ FHEVM SDK instance created successfully");
    return sdkInstance;
  } catch (err) {
    console.error("❌ FHEVM SDK instance creation failed:", err);
    throw err;
  }
}

// -------------------------------------------------------------------
// Encryption / Decryption
// -------------------------------------------------------------------
function toHexString(byteArray: Uint8Array): string {
  return "0x" + Array.from(byteArray, (b) => ("0" + (b & 0xff).toString(16)).slice(-2)).join("");
}

export async function encryptVote(
  choice: number,
  weight: number,
  contractAddress: string = CONTRACT_ADDRESS,
  userAddress?: string
) {
  if (choice !== 0 && choice !== 1) throw new Error("Vote choice must be 0 or 1");
  if (weight < 1 || weight > 10) throw new Error("Weight must be between 1–10");

  const inst = await initializeSDK();
  const addr = userAddress || (await (await inst.network.getSigner()).getAddress());
  
  console.log("🔐 Encrypting vote for address:", addr);
  
  const buffer = inst.createEncryptedInput(contractAddress, addr);
  buffer.add8(BigInt(choice));
  buffer.add8(BigInt(weight));

  // Let browser repaint before CPU-intensive encryption
  await new Promise((resolve) => setTimeout(resolve, 100));
  
  const ciphertexts = await buffer.encrypt();
  
  console.log("✅ Vote encrypted successfully");
  
  return {
    voteHandleBytes: toHexString(ciphertexts.handles[0]),
    weightHandleBytes: toHexString(ciphertexts.handles[1]),
    attestation: toHexString(ciphertexts.inputProof),
  };
}

export async function decryptHandle(handle: string): Promise<number> {
  const inst = await initializeSDK();
  console.log("🔓 Decrypting handle...");
  const values = await inst.publicDecrypt([handle]);
  const result = values[handle];
  console.log("✅ Decryption successful:", result);
  return result;
}

// -------------------------------------------------------------------
// Transaction helpers
// -------------------------------------------------------------------
export async function sendFHETransaction(
  contract: ethers.Contract,
  methodName: string,
  params: any[],
  signer: ethers.JsonRpcSigner
): Promise<ethers.ContractTransactionResponse> {
  try {
    console.log(`🔄 Preparing ${methodName} transaction...`);
    console.log(`📋 Parameters:`, params);

    const contractWithSigner = contract.connect(signer);
    
    // Gas limits for different functions
    const gasLimits: { [key: string]: number } = {
      "castVote": 5000000,
      "init": 1000000,
      "makeTallyPublic": 1000000,
    };
    
    const gasLimit = gasLimits[methodName] || 1000000;

    let tx: ethers.ContractTransactionResponse;

    switch (methodName) {
      case "castVote":
        tx = await contractWithSigner.castVote(
          params[0], // voteHandleBytes
          params[1], // weightHandleBytes
          params[2], // attestation
          params[3], // extraData
          { gasLimit }
        );
        break;
      case "init":
        tx = await contractWithSigner.init({ gasLimit });
        break;
      case "makeTallyPublic":
        tx = await contractWithSigner.makeTallyPublic({ gasLimit });
        break;
      default:
        throw new Error(`Unknown method: ${methodName}`);
    }
    
    console.log(`📝 ${methodName} transaction sent:`, tx.hash);
    console.log(`📄 Transaction data present:`, tx.data !== '0x');
    
    return tx;
  } catch (error: any) {
    console.error(`❌ ${methodName} transaction failed:`, error);
    
    // Enhanced error information
    if (error.info && error.info.error) {
      console.error("📄 Detailed error info:", error.info.error);
    }
    
    throw error;
  }
}