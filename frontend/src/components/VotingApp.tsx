"use client";

import React, { useState, useEffect } from "react";
import { useWalletEthersSigner } from "./useWalletEthersSigner";
import { useConfidentialVoting } from "../hooks/useConfidentialVoting";
import { CONTRACT_ADDRESS, checkContractConnection, debugContractState } from "../lib/fhevm";

const SEPOLIA_CHAIN_ID = "11155111";

const WalletButton: React.FC<{ onConnect(): void; loading?: boolean }> = ({ onConnect, loading }) => (
  <button
    onClick={onConnect}
    className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-semibold shadow-md hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed transform hover:scale-105"
    disabled={loading}
  >
    {loading ? "Connecting..." : "Connect Wallet"}
  </button>
);

const VotingApp: React.FC = () => {
  const { ethersBrowserProvider, ethersSigner, chainId, accounts, isConnected, connect, error: walletError } = useWalletEthersSigner();
  const [voteChoice, setVoteChoice] = useState<number | null>(null);
  const [weight, setWeight] = useState<number>(1);
  const [tally, setTally] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [walletType, setWalletType] = useState<string>("Unknown");
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [showDebug, setShowDebug] = useState(false);

  const userAddress = accounts && accounts.length > 0 ? accounts[0] : undefined;

  const {
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
  } = useConfidentialVoting({
    ethersSigner,
    ethersBrowserProvider,
    chainId,
    userAddress,
  });

  // Debug vote conditions function
  const debugVoteConditions = async () => {
    if (!contract || !userAddress) {
      console.error("❌ Contract or user address not available");
      return;
    }

    try {
      console.log("🔍 Debugging vote conditions...");
      
      const [initialized, registered, hasVoted, votingEndTime, currentTime] = await Promise.all([
        contract.initialized(),
        contract.isRegistered(userAddress),
        contract.hasVoted(userAddress),
        contract.votingEndTime(),
        Math.floor(Date.now() / 1000)
      ]);

      const votingOpen = Number(votingEndTime) > currentTime;

      console.log("📊 Vote Conditions:", {
        initialized,
        registered,
        hasVoted,
        votingEndTime: Number(votingEndTime),
        currentTime,
        votingOpen,
        timeLeft: Number(votingEndTime) - currentTime
      });

      // Check what's causing the revert
      if (!initialized) {
        console.error("❌ Contract not initialized");
      }
      if (hasVoted) {
        console.error("❌ User already voted");
      }
      if (!votingOpen) {
        console.error("❌ Voting period ended");
      }
      if (!registered) {
        console.error("❌ User not registered");
      }

      alert(`Vote Conditions:\n
Initialized: ${initialized}\n
Registered: ${registered}\n
Has Voted: ${hasVoted}\n
Voting Open: ${votingOpen}\n
Time Left: ${Number(votingEndTime) - currentTime} seconds\n
Check console for details.`);

    } catch (error) {
      console.error("❌ Debug failed:", error);
      alert("Debug failed - check console for details");
    }
  };

  // Contract initialization check
  useEffect(() => {
    if (contract && isConnected && !isInitialized && isAdmin) {
      console.log("⚠️ Contract not initialized - admin can initialize");
    } else if (contract && isConnected && !isInitialized) {
      console.log("⚠️ Contract not initialized - waiting for admin");
    }
  }, [contract, isConnected, isInitialized, isAdmin]);

  // Debug logging - TEMPORARY
  useEffect(() => {
    const debugState = {
      contract: !!contract,
      isDeployed,
      isInitialized,
      isRegistered,
      hasVoted,
      isAdmin,
      contractAddress: CONTRACT_ADDRESS,
      userAddress,
      isConnected,
      chainId,
      chainMatches: chainId === SEPOLIA_CHAIN_ID,
      votingEndTime,
      currentTime: Math.floor(Date.now() / 1000),
      votingOpen: votingEndTime ? Math.floor(Date.now() / 1000) < votingEndTime : false
    };
    
    console.log("🔍 DEBUG - Contract state:", debugState);
    setDebugInfo(JSON.stringify(debugState, null, 2));
    
    if (contract && userAddress) {
      console.log("🔍 DEBUG - Contract methods:", Object.keys(contract).filter(key => typeof contract[key] === 'function'));
      console.log("🔍 DEBUG - castVote exists:", !!contract.castVote);
      
      // Test contract connection
      checkContractConnection(contract).then(connected => {
        console.log("🔍 DEBUG - Contract connection test:", connected);
      });

      // Debug contract state
      debugContractState(contract, userAddress).then(state => {
        console.log("🔍 DEBUG - Contract state details:", state);
      });
    }
  }, [contract, isDeployed, isInitialized, isRegistered, hasVoted, isAdmin, userAddress, isConnected, chainId, votingEndTime]);

  // Update wallet type
  useEffect(() => {
    if (isConnected && userAddress) {
      setWalletType(
        (window as any).ethereum?.isMetaMask ? "MetaMask" :
        (window as any).okxwallet ? "OKX Wallet" :
        (window as any).coinbaseWalletExtension ? "Coinbase Wallet" : "Unknown"
      );
    } else {
      setWalletType("Unknown");
    }
  }, [isConnected, userAddress]);

  // Handle voting with proper loading states
  const handleVote = async (choice: number, weight: number) => {
    setLoading(true);
    try {
      console.log("🔄 Starting vote process with:", { choice, weight });
      await castVote(choice, weight);
      setVoteChoice(null);
    } catch (e: any) {
      console.error("❌ Vote failed:", e);
    } finally {
      setLoading(false);
    }
  };

  // Handle tally fetch
  const handleFetchTally = async () => {
    setLoading(true);
    try {
      console.log("🔄 Fetching tally...");
      const result = await fetchTally();
      if (result) setTally(result);
    } catch (e: any) {
      console.error("❌ Fetch tally failed:", e);
    } finally {
      setLoading(false);
    }
  };

  // Handle make tally public
  const handleMakeTallyPublic = async () => {
    setLoading(true);
    try {
      console.log("🔄 Making tally public...");
      await makeTallyPublic();
    } catch (e: any) {
      console.error("❌ Make tally public failed:", e);
    } finally {
      setLoading(false);
    }
  };

  // Handle contract initialization
  const handleInitializeContract = async () => {
    setLoading(true);
    try {
      console.log("🔄 Initializing contract...");
      await initializeContract();
    } catch (e: any) {
      console.error("❌ Initialize contract failed:", e);
    } finally {
      setLoading(false);
    }
  };

  // Test contract connection manually
  const testContractConnection = async () => {
    if (!contract) {
      alert("Contract not available");
      return;
    }
    try {
      const connected = await checkContractConnection(contract);
      alert(connected ? "✅ Contract connection successful!" : "❌ Contract connection failed");
    } catch (error) {
      console.error("Test failed:", error);
      alert("❌ Test failed: " + error);
    }
  };

  // Test contract state manually
  const testContractState = async () => {
    if (!contract || !userAddress) {
      alert("Contract or user address not available");
      return;
    }
    try {
      const state = await debugContractState(contract, userAddress);
      console.log("Manual state test:", state);
      alert("✅ Contract state test completed - check console");
    } catch (error) {
      console.error("State test failed:", error);
      alert("❌ State test failed: " + error);
    }
  };

  // Format voting end time
  const formatVotingEndTime = () => {
    if (!votingEndTime) return "Loading...";
    const now = Math.floor(Date.now() / 1000);
    const timeLeft = votingEndTime - now;
    
    if (timeLeft <= 0) return "Voting ended";
    
    const hours = Math.floor(timeLeft / 3600);
    const minutes = Math.floor((timeLeft % 3600) / 60);
    
    return `Ends in ${hours}h ${minutes}m`;
  };

  // Check if voting is open
  const isVotingOpen = votingEndTime ? Math.floor(Date.now() / 1000) < votingEndTime : false;

  // FIXED: Only show "not deployed" message when we're connected AND contract is confirmed not deployed
  if (isConnected && isDeployed === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 p-6 flex items-center justify-center">
        <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl p-8 transform transition-all duration-500 hover:shadow-3xl">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mb-2 animate-pulse">
            Confidential Voting (FHE)
          </h1>
          <p className="text-red-600 font-medium">
            Contract is not deployed at address {CONTRACT_ADDRESS}. Please check the contract address or deploy the contract.
          </p>
          
          {/* Debug Info */}
          <div className="mt-6 p-4 bg-gray-100 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold">Debug Information:</h3>
              <button
                onClick={() => setShowDebug(!showDebug)}
                className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
              >
                {showDebug ? "Hide" : "Show"} Debug
              </button>
            </div>
            {showDebug && (
              <pre className="text-xs overflow-auto max-h-40">{debugInfo}</pre>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 p-6 flex items-center justify-center">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl p-8 transform transition-all duration-500 hover:shadow-3xl">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mb-2 animate-pulse">
              Confidential Voting (FHE)
            </h1>
            <p className="text-sm text-slate-600">
              Securely cast encrypted votes using Fully Homomorphic Encryption. Connect with any wallet (MetaMask, OKX, Coinbase, etc.). Your first vote auto-registers you.
            </p>
          </div>
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
          >
            {showDebug ? "Hide" : "Show"} Debug
          </button>
        </div>

        {/* Debug Panel - TEMPORARY */}
        {showDebug && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-yellow-800">Debug Panel</h3>
              <div className="space-x-2">
                <button
                  onClick={testContractConnection}
                  className="px-3 py-1 bg-yellow-500 text-white text-sm rounded hover:bg-yellow-600"
                >
                  Test Connection
                </button>
                <button
                  onClick={testContractState}
                  className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                >
                  Test State
                </button>
                <button
                  onClick={debugVoteConditions}
                  className="px-3 py-1 bg-purple-500 text-white text-sm rounded hover:bg-purple-600"
                >
                  Debug Vote
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                >
                  Refresh
                </button>
              </div>
            </div>
            <pre className="text-xs text-yellow-700 overflow-auto max-h-32 bg-yellow-100 p-2 rounded">
              {debugInfo}
            </pre>
          </div>
        )}

        {!isConnected ? (
          <>
            <div className="mb-6 animate-fade-in">
              <p className="text-red-600 font-medium">
                {error ?? walletError?.message ?? "Connect a wallet to start voting."}
              </p>
            </div>
            <WalletButton onConnect={connect} loading={loading} />
          </>
        ) : (
          <>
            {/* Show loading while checking deployment */}
            {isDeployed === null && (
              <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-lg animate-fade-in">
                <div className="text-sm text-blue-800 font-medium">
                  🔍 Checking contract deployment...
                </div>
              </div>
            )}

            {/* Admin initialization prompt */}
            {isAdmin && !isInitialized && (
              <div className="p-4 mb-6 bg-yellow-50 border-l-4 border-yellow-500 rounded-lg animate-fade-in">
                <div className="text-sm text-yellow-800 font-medium">
                  Contract not initialized. You are the admin - please initialize the contract.
                </div>
                <button
                  className="mt-3 w-full px-6 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-semibold shadow-md hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed transform hover:scale-105"
                  onClick={handleInitializeContract}
                  disabled={loading}
                >
                  {loading ? "Initializing..." : "Initialize Contract (Admin)"}
                </button>
              </div>
            )}

            <div className="mb-6 p-4 border rounded-lg bg-gradient-to-r from-slate-50 to-slate-100 shadow-inner">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-500">Connected Address</div>
                  <div className="font-mono text-sm text-slate-800 bg-slate-200 px-2 py-1 rounded">{userAddress}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-500">
                    Wallet: {walletType} | Network: {chainId === SEPOLIA_CHAIN_ID ? "Sepolia" : `Unknown (${chainId})`}
                  </div>
                  <div className="text-sm font-medium text-slate-700 mt-1">
                    {formatVotingEndTime()}
                  </div>
                </div>
              </div>
            </div>

            {chainId !== SEPOLIA_CHAIN_ID && (
              <div className="p-4 mb-6 bg-red-50 border-l-4 border-red-500 rounded-lg animate-fade-in">
                <div className="text-sm text-red-800 font-medium">
                  ❌ Wrong network! Please switch to Sepolia network to use this dApp.
                </div>
              </div>
            )}

            {!isVotingOpen && votingEndTime && (
              <div className="p-4 mb-6 bg-red-50 border-l-4 border-red-500 rounded-lg animate-fade-in">
                <div className="text-sm text-red-800 font-medium">
                  ❌ Voting period has ended. No more votes can be cast.
                </div>
              </div>
            )}

            {!isInitialized && !isAdmin && (
              <div className="p-4 mb-6 bg-yellow-50 border-l-4 border-yellow-500 rounded-lg animate-fade-in">
                <div className="text-sm text-yellow-800 font-medium">
                  Contract not initialized. Admin must initialize to enable voting.
                </div>
              </div>
            )}

            {isInitialized && !isRegistered && (
              <div className="p-4 mb-6 bg-blue-50 border-l-4 border-blue-500 rounded-lg animate-fade-in">
                <div className="text-sm text-blue-800 font-medium">
                  You are not registered yet. Your first vote will auto-register you.
                </div>
              </div>
            )}

            {isInitialized && isRegistered && hasVoted && (
              <div className="p-4 mb-6 bg-green-50 border-l-4 border-green-500 rounded-lg animate-fade-in">
                <div className="text-sm text-green-800 font-medium">✅ You have already voted. Thank you for participating!</div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Vote Casting Section */}
              <div className="p-6 border rounded-lg bg-white shadow-md transition-all duration-300 hover:shadow-lg">
                <h3 className="font-semibold text-lg mb-3 text-slate-800">Cast Your Vote</h3>
                
                {/* Voting Status */}
                <div className="mb-4 p-3 bg-slate-50 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Status:</span>
                    <span className={`font-medium ${
                      !isInitialized ? 'text-yellow-600' :
                      hasVoted ? 'text-green-600' :
                      !isVotingOpen ? 'text-red-600' :
                      'text-blue-600'
                    }`}>
                      {!isInitialized ? 'Contract Not Ready' :
                       hasVoted ? 'Already Voted' :
                       !isVotingOpen ? 'Voting Ended' :
                       'Ready to Vote'}
                    </span>
                  </div>
                </div>

                <div className="flex space-x-3 mb-4">
                  <button
                    onClick={() => setVoteChoice(1)}
                    className={`flex-1 py-3 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 ${
                      voteChoice === 1
                        ? "bg-gradient-to-r from-green-500 to-green-600 text-white shadow-md"
                        : "bg-green-100 text-green-800 hover:bg-green-200"
                    }`}
                    disabled={isEncrypting || isSubmitting || hasVoted || !isInitialized || !isVotingOpen || chainId !== SEPOLIA_CHAIN_ID}
                  >
                    👍 Yes
                  </button>
                  <button
                    onClick={() => setVoteChoice(0)}
                    className={`flex-1 py-3 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 ${
                      voteChoice === 0
                        ? "bg-gradient-to-r from-red-500 to-red-600 text-white shadow-md"
                        : "bg-red-100 text-red-800 hover:bg-red-200"
                    }`}
                    disabled={isEncrypting || isSubmitting || hasVoted || !isInitialized || !isVotingOpen || chainId !== SEPOLIA_CHAIN_ID}
                  >
                    👎 No
                  </button>
                </div>
                
                {voteChoice !== null && !hasVoted && isInitialized && isVotingOpen && chainId === SEPOLIA_CHAIN_ID && (
                  <>
                    <label className="block text-sm font-medium text-slate-600 mb-2">
                      Vote Weight (1-10)
                      <span className="text-xs text-slate-400 ml-1">- Higher weight = stronger vote</span>
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={weight}
                      onChange={(e) => setWeight(Number(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer mb-2"
                    />
                    <div className="flex justify-between text-xs text-slate-500 mb-4">
                      <span>Light (1)</span>
                      <span className="font-medium">Current: {weight}</span>
                      <span>Strong (10)</span>
                    </div>
                    
                    {/* Loading States for Voting */}
                    {isEncrypting && (
                      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                          <span className="text-sm text-blue-700">🔐 Encrypting your vote with FHE...</span>
                        </div>
                        <p className="text-xs text-blue-600 mt-1">This may take a few seconds</p>
                      </div>
                    )}
                    
                    {isSubmitting && (
                      <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                          <span className="text-sm text-purple-700">📤 Submitting to blockchain...</span>
                        </div>
                        <p className="text-xs text-purple-600 mt-1">Confirm the transaction in your wallet</p>
                      </div>
                    )}

                    <button
                      className="w-full px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg font-semibold shadow-md hover:from-indigo-600 hover:to-purple-700 transition-all duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed transform hover:scale-105 flex items-center justify-center space-x-2"
                      onClick={() => handleVote(voteChoice, weight)}
                      disabled={isEncrypting || isSubmitting}
                    >
                      {isEncrypting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Encrypting Vote...</span>
                        </>
                      ) : isSubmitting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <>
                          <span>🗳️ Submit Encrypted Vote</span>
                        </>
                      )}
                    </button>
                    
                    <p className="text-xs text-slate-500 mt-2 text-center">
                      🔒 Your vote will be encrypted and cannot be viewed by anyone
                    </p>
                  </>
                )}
              </div>

              {/* Tally Section */}
              <div className="p-6 border rounded-lg bg-white shadow-md transition-all duration-300 hover:shadow-lg">
                <h3 className="font-semibold text-lg mb-3 text-slate-800">Voting Results</h3>
                <p className="text-sm text-slate-600 mb-4">
                  {isAdmin 
                    ? "As admin, you can view and manage the encrypted tally"
                    : "Tally access requires admin permission"
                  }
                </p>
                
                <div className="space-y-3">
                  <button
                    className="w-full py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg font-semibold shadow-md hover:from-purple-600 hover:to-purple-700 transition-all duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed transform hover:scale-105 flex items-center justify-center space-x-2"
                    onClick={handleFetchTally}
                    disabled={loading || !isInitialized || chainId !== SEPOLIA_CHAIN_ID}
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Decrypting...</span>
                      </>
                    ) : (
                      <>
                        <span>🔍 View Encrypted Tally</span>
                      </>
                    )}
                  </button>
                  
                  {isAdmin && (
                    <button
                      className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg font-semibold shadow-md hover:from-orange-600 hover:to-orange-700 transition-all duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed transform hover:scale-105"
                      onClick={handleMakeTallyPublic}
                      disabled={loading || chainId !== SEPOLIA_CHAIN_ID}
                    >
                      {loading ? "Processing..." : "🔓 Make Tally Public"}
                    </button>
                  )}
                </div>
                
                {tally && (
                  <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg animate-fade-in">
                    <h4 className="font-semibold text-green-800 mb-2">📊 Voting Results (Decrypted)</h4>
                    <div className="text-lg font-mono text-center font-bold text-slate-800">
                      {tally}
                    </div>
                    <p className="text-xs text-slate-500 mt-2 text-center">
                      These results were computed homomorphically while encrypted
                    </p>
                  </div>
                )}
                
                {!isAdmin && (
                  <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-600 text-center">
                      🔐 Tally is encrypted. Only authorized addresses can decrypt the results.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Admin Panel */}
            {isAdmin && (
              <div className="mt-6 p-6 border rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 shadow-md">
                <h3 className="font-semibold text-lg mb-3 text-amber-800">👑 Admin Panel</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 bg-white rounded-lg border">
                    <h4 className="font-medium text-amber-700 mb-2">Contract Status</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Initialized:</span>
                        <span className={isInitialized ? "text-green-600 font-medium" : "text-red-600"}>
                          {isInitialized ? "✅ Yes" : "❌ No"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Voting Period:</span>
                        <span className={isVotingOpen ? "text-green-600" : "text-red-600"}>
                          {isVotingOpen ? "🟢 Open" : "🔴 Closed"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 bg-white rounded-lg border">
                    <h4 className="font-medium text-amber-700 mb-2">Admin Actions</h4>
                    <div className="space-y-2">
                      {!isInitialized && (
                        <button
                          onClick={handleInitializeContract}
                          className="w-full px-3 py-2 bg-amber-500 text-white text-sm rounded hover:bg-amber-600 disabled:bg-gray-400"
                          disabled={loading}
                        >
                          {loading ? "Initializing..." : "Initialize Contract"}
                        </button>
                      )}
                      <button
                        onClick={handleMakeTallyPublic}
                        className="w-full px-3 py-2 bg-green-500 text-white text-sm rounded hover:bg-green-600 disabled:bg-gray-400"
                        disabled={loading}
                      >
                        {loading ? "Processing..." : "Make Tally Public"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="p-4 mb-3 bg-red-50 border-l-4 border-red-500 rounded-lg animate-fade-in">
                <div className="text-red-700 font-medium">{error}</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default VotingApp;