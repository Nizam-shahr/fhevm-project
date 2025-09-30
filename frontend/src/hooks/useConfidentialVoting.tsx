"use client";

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { 
  CONTRACT_ADDRESS, 
  CONTRACT_ABI, 
  encryptVote, 
  decryptHandle, 
  initializeSDK, 
  checkContractConnection,
  verifyContractReadiness,
  debugContractState,
  sendFHETransaction,
  checkContractDeployment
} from "../lib/fhevm";

interface UseConfidentialVotingProps {
  ethersSigner: ethers.JsonRpcSigner | undefined;
  ethersBrowserProvider: ethers.BrowserProvider | undefined;
  chainId: string | undefined;
  userAddress: string | undefined;
}

interface ConfidentialVotingState {
  contract: ethers.Contract | null;
  isDeployed: boolean | null;
  isInitialized: boolean;
  isRegistered: boolean;
  hasVoted: boolean;
  isAdmin: boolean;
  votingEndTime: number | null;
  error: string | null;
  isLoading: boolean;
  isEncrypting: boolean;
  isSubmitting: boolean;
  castVote: (choice: number, weight: number) => Promise<void>;
  fetchTally: () => Promise<string | null>;
  makeTallyPublic: () => Promise<void>;
  initializeContract: () => Promise<void>;
  registerVoter: (voterAddress: string) => Promise<void>;
  grantTallyAccess: (viewerAddress: string) => Promise<void>;
  refreshContractState: () => Promise<void>;
}

export const useConfidentialVoting = ({
  ethersSigner,
  ethersBrowserProvider,
  chainId,
  userAddress,
}: UseConfidentialVotingProps): ConfidentialVotingState => {
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [isDeployed, setIsDeployed] = useState<boolean | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [votingEndTime, setVotingEndTime] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const SEPOLIA_CHAIN_ID = "11155111";

  // Enhanced contract state reader with retry logic
  const readContractState = useCallback(async (contract: ethers.Contract, address: string, retries = 3, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
      try {
        console.log(`📊 Reading contract state (attempt ${i + 1}/${retries})...`);
        
        const [initialized, registered, voted, admin, endTime] = await Promise.all([
          contract.initialized(),
          contract.isRegistered(address),
          contract.hasVoted(address),
          contract.admin(),
          contract.votingEndTime(),
        ]);
        
        console.log("✅ Contract state loaded:", { initialized, registered, voted, admin, endTime });
        return { initialized, registered, voted, admin, endTime: Number(endTime) };
      } catch (err) {
        console.error(`❌ Contract state read failed (attempt ${i + 1}):`, err);
        if (i === retries - 1) throw err;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error("Failed to read contract state after retries");
  }, []);

  // Reset all contract state when wallet disconnects
  const resetContractState = useCallback(() => {
    console.log("🔄 Resetting contract state due to wallet disconnect");
    setContract(null);
    setIsDeployed(null);
    setIsInitialized(false);
    setIsRegistered(false);
    setHasVoted(false);
    setIsAdmin(false);
    setVotingEndTime(null);
    setError(null);
  }, []);

  // Refresh contract state
  const refreshContractState = useCallback(async (): Promise<void> => {
    if (!contract || !userAddress) return;
    
    try {
      console.log("🔄 Refreshing contract state...");
      const state = await readContractState(contract, userAddress);
      
      setIsInitialized(state.initialized);
      setIsRegistered(Boolean(state.registered));
      setHasVoted(Boolean(state.voted));
      setIsAdmin(userAddress.toLowerCase() === state.admin.toLowerCase());
      setVotingEndTime(state.endTime);
      
      console.log("✅ Contract state refreshed");
    } catch (err: any) {
      console.error("❌ Failed to refresh contract state:", err);
    }
  }, [contract, userAddress, readContractState]);

  // Initialize contract and SDK
  useEffect(() => {
    // Reset state when wallet disconnects or chain changes
    if (!ethersBrowserProvider || !ethersSigner || !userAddress || chainId !== SEPOLIA_CHAIN_ID) {
      console.log("⏳ Resetting state - waiting for dependencies:", {
        ethersBrowserProvider: !!ethersBrowserProvider,
        ethersSigner: !!ethersSigner,
        userAddress: !!userAddress,
        chainId,
        requiredChainId: SEPOLIA_CHAIN_ID
      });
      resetContractState();
      return;
    }

    const initialize = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        console.log("🚀 Initializing Confidential Voting DApp...");
        
        // Check contract deployment first using the imported function
        console.log("🔍 Checking contract deployment...");
        const deployed = await checkContractDeployment(ethersBrowserProvider);
        if (!deployed) {
          setIsDeployed(false);
          setError(`Contract is not deployed at address ${CONTRACT_ADDRESS}. Please check the contract address or deploy the contract.`);
          setIsLoading(false);
          return;
        }
        
        setIsDeployed(true);
        console.log("✅ Contract is deployed");

        // Create contract instance
        console.log("🔧 Creating contract instance...");
        const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, ethersSigner);
        setContract(contractInstance);

        // Verify contract is callable
        console.log("🔍 Verifying contract callability...");
        const isCallable = await verifyContractReadiness(contractInstance);
        if (!isCallable) {
          throw new Error("Contract is deployed but not callable. Check ABI and address.");
        }

        // Initialize FHEVM SDK
        console.log("🔐 Initializing FHEVM SDK...");
        await initializeSDK();

        // Verify contract connection and read state
        console.log("📡 Connecting to contract...");
        const isConnected = await checkContractConnection(contractInstance);
        if (!isConnected) {
          throw new Error("Failed to connect to contract");
        }

        // Debug contract state
        await debugContractState(contractInstance, userAddress);

        const state = await readContractState(contractInstance, userAddress);
        
        // Update state
        setIsInitialized(state.initialized);
        setIsRegistered(Boolean(state.registered));
        setHasVoted(Boolean(state.voted));
        setIsAdmin(userAddress.toLowerCase() === state.admin.toLowerCase());
        setVotingEndTime(state.endTime);
        
        console.log("🎉 Confidential Voting DApp initialized successfully");
        
      } catch (err: any) {
        console.error("❌ Initialization failed:", err);
        // Only set error if we have an active connection
        if (ethersSigner && userAddress) {
          setError(`Initialization error: ${err.message}`);
        }
        // Mark as not deployed if initialization fails
        setIsDeployed(false);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, [
    ethersBrowserProvider, 
    ethersSigner, 
    userAddress, 
    chainId, 
    readContractState, 
    resetContractState
  ]);

  // Initialize contract (admin only)
  const initializeContract = async (): Promise<void> => {
    if (!contract || !ethersSigner) {
      setError("Contract or signer not ready");
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      console.log("🔧 Initializing contract...");
      
      const tx = await sendFHETransaction(contract, "init", [], ethersSigner);
      await tx.wait();
      
      setIsInitialized(true);
      console.log("✅ Contract initialized successfully");
    } catch (err: any) {
      console.error("❌ Contract initialization failed:", err);
      setError(`Initialization failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Main voting function with comprehensive FHE operations and proper loading states
  const castVote = async (choice: number, weight: number): Promise<void> => {
    if (!contract || !ethersSigner || !userAddress) {
      setError("Wallet not connected");
      return;
    }

    // Debug current state before validation
    console.log("🔍 Pre-vote validation:", {
      isInitialized,
      hasVoted,
      votingEndTime,
      currentTime: Math.floor(Date.now() / 1000),
      votingOpen: votingEndTime ? Math.floor(Date.now() / 1000) < votingEndTime : false
    });

    // Validation checks
    if (!isInitialized) {
      setError("Contract not initialized");
      return;
    }
    if (hasVoted) {
      setError("You have already voted");
      return;
    }
    if (votingEndTime && Date.now() / 1000 > votingEndTime) {
      setError("Voting period has ended");
      return;
    }

    // Note: We don't check isRegistered here because the contract auto-registers on first vote

    setError(null);
    
    try {
      console.log("🗳️ Starting vote casting process...");
      
      // Step 1: Encrypt vote using FHE (show encryption loading)
      console.log("🔐 Encrypting vote with FHE...");
      setIsEncrypting(true);
      
      // Let browser repaint before CPU-intensive encryption (like template)
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      const { voteHandleBytes, weightHandleBytes, attestation } = await encryptVote(
        choice, 
        weight, 
        CONTRACT_ADDRESS, 
        userAddress
      );

      setIsEncrypting(false);
      console.log("✅ Vote encrypted successfully");

      // Step 2: Send encrypted vote to contract using proper FHEVM pattern
      console.log("📤 Submitting encrypted vote to blockchain...");
      setIsSubmitting(true);
      
      // Use the direct transaction sending with manual gas limits
      const tx = await sendFHETransaction(
        contract, 
        "castVote", 
        [voteHandleBytes, weightHandleBytes, attestation, "0x"], 
        ethersSigner
      );
      
      // Step 3: Wait for confirmation
      console.log("⏳ Waiting for transaction confirmation...");
      const receipt = await tx.wait();
      console.log("✅ Vote transaction confirmed:", receipt);

      // Step 4: Update local state
      setHasVoted(true);
      setIsRegistered(true); // Auto-registration happens in contract
      
      console.log("🎉 Vote cast successfully!");
      
    } catch (err: any) {
      console.error("❌ Vote casting failed:", err);
      
      // Enhanced error handling with more specific messages
      if (err.code === "CALL_EXCEPTION") {
        if (err.data) {
          // Try to decode the revert reason
          try {
            const decodedError = contract.interface.parseError(err.data);
            const revertReason = decodedError?.name || "Unknown revert reason";
            console.error(`📄 Revert reason: ${revertReason}`);
            setError(`Transaction reverted: ${revertReason}`);
          } catch {
            console.error("📄 Could not decode revert reason");
            setError("Transaction reverted. This might be due to: 1) Voting period ended, 2) Already voted, 3) Invalid FHE parameters, 4) Registration issue");
          }
        } else {
          console.error("📄 No revert data available");
          setError("Transaction reverted. Check voting period and registration.");
        }
      } else if (err.message?.includes("user rejected")) {
        setError("Transaction was rejected by user.");
      } else if (err.message?.includes("insufficient funds")) {
        setError("Insufficient funds for gas. Please add ETH to your wallet.");
      } else if (err.message?.includes("gas")) {
        setError("Gas estimation failed. Please try again with higher gas limit.");
      } else if (err.message?.includes("scam") || err.message?.includes("risk")) {
        setError("Wallet detected potential risk. This is a legitimate FHE voting dApp. Please confirm the transaction.");
      } else {
        setError(`Vote failed: ${err.message || "Unknown error"}`);
      }
    } finally {
      setIsEncrypting(false);
      setIsSubmitting(false);
    }
  };

  // Fetch encrypted tally and decrypt
  const fetchTally = async (): Promise<string | null> => {
    if (!contract) {
      setError("Contract not ready");
      return null;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      console.log("📊 Fetching encrypted tally...");
      
      const [yesHandle, noHandle] = await contract.getEncryptedTally();
      console.log("✅ Tally handles received");
      
      // Decrypt both handles
      const [yesVotes, noVotes] = await Promise.all([
        decryptHandle(yesHandle),
        decryptHandle(noHandle)
      ]);
      
      const result = `Yes Votes: ${yesVotes} | No Votes: ${noVotes}`;
      console.log("✅ Tally decrypted:", result);
      
      return result;
    } catch (err: any) {
      console.error("❌ Tally fetch failed:", err);
      setError(`Failed to fetch tally: ${err.message}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Make tally publicly decryptable (admin only)
  const makeTallyPublic = async (): Promise<void> => {
    if (!contract || !ethersSigner) {
      setError("Contract or signer not ready");
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      console.log("🔓 Making tally publicly decryptable...");
      
      const tx = await sendFHETransaction(contract, "makeTallyPublic", [], ethersSigner);
      await tx.wait();
      
      console.log("✅ Tally is now publicly decryptable");
    } catch (err: any) {
      console.error("❌ Make tally public failed:", err);
      setError(`Failed to make tally public: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Register a voter (admin only)
  const registerVoter = async (voterAddress: string): Promise<void> => {
    if (!contract || !ethersSigner) {
      setError("Contract or signer not ready");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log("👤 Registering voter:", voterAddress);
      
      const tx = await sendFHETransaction(
        contract, 
        "registerVoter", 
        [voterAddress, "0x"], 
        ethersSigner
      );
      await tx.wait();
      
      console.log("✅ Voter registered:", voterAddress);
      
      // Refresh state to reflect the new registration
      await refreshContractState();
    } catch (err: any) {
      console.error("❌ Voter registration failed:", err);
      setError(`Voter registration failed: ${err.message}`);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Grant tally access to a viewer (admin only)
  const grantTallyAccess = async (viewerAddress: string): Promise<void> => {
    if (!contract || !ethersSigner) {
      setError("Contract or signer not ready");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log("🔑 Granting tally access to:", viewerAddress);
      
      const tx = await sendFHETransaction(
        contract, 
        "allowTallyAccess", 
        [viewerAddress, "0x"], 
        ethersSigner
      );
      await tx.wait();
      
      console.log("✅ Tally access granted to:", viewerAddress);
    } catch (err: any) {
      console.error("❌ Grant tally access failed:", err);
      setError(`Grant tally access failed: ${err.message}`);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-refresh contract state when user changes
  useEffect(() => {
    if (userAddress && contract) {
      refreshContractState();
    }
  }, [userAddress, contract, refreshContractState]);

  return {
    contract,
    isDeployed,
    isInitialized,
    isRegistered,
    hasVoted,
    isAdmin,
    votingEndTime,
    error,
    isLoading,
    isEncrypting,
    isSubmitting,
    castVote,
    fetchTally,
    makeTallyPublic,
    initializeContract,
    registerVoter,
    grantTallyAccess,
    refreshContractState,
  };
};