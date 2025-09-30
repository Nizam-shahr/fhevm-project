"use client";

import { ethers } from "ethers";
import {
  createContext,
  ReactNode,
  RefObject,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export interface UseWalletEthersSignerState {
  provider: ethers.Eip1193Provider | undefined;
  chainId: string | undefined;
  accounts: string[] | undefined;
  isConnected: boolean;
  error: Error | undefined;
  connect: () => void;
  sameChain: RefObject<(chainId: string | undefined) => boolean>;
  sameSigner: RefObject<(ethersSigner: ethers.JsonRpcSigner | undefined) => boolean>;
  ethersBrowserProvider: ethers.BrowserProvider | undefined;
  ethersSigner: ethers.JsonRpcSigner | undefined;
}

function useWalletEthersSignerInternal(): UseWalletEthersSignerState {
  const [provider, setProvider] = useState<ethers.Eip1193Provider | undefined>(undefined);
  const [chainId, setChainId] = useState<string | undefined>(undefined);
  const [accounts, setAccounts] = useState<string[] | undefined>(undefined);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [ethersBrowserProvider, setEthersBrowserProvider] = useState<ethers.BrowserProvider | undefined>(undefined);
  const [ethersSigner, setEthersSigner] = useState<ethers.JsonRpcSigner | undefined>(undefined);

  const chainIdRef = useRef<string | undefined>(chainId);
  const ethersSignerRef = useRef<ethers.JsonRpcSigner | undefined>(undefined);

  const sameChain = useRef((id: string | undefined) => id === chainIdRef.current);
  const sameSigner = useRef((signer: ethers.JsonRpcSigner | undefined) => signer === ethersSignerRef.current);

  const detectProvider = () => {
    if (typeof window === "undefined") return null;
    const win = window as any;
    if (win.ethereum?.isMetaMask) return { provider: win.ethereum, type: "MetaMask" };
    if (win.okxwallet) return { provider: win.okxwallet, type: "OKX Wallet" };
    if (win.coinbaseWalletExtension) return { provider: win.coinbaseWalletExtension, type: "Coinbase Wallet" };
    return null;
  };

  const connect = async () => {
    setError(undefined);
    try {
      const injected = detectProvider();
      if (!injected) throw new Error("No wallet detected. Please install MetaMask, OKX Wallet, or Coinbase Wallet.");

      const p = injected.provider;
      const accounts = await p.request({ method: "eth_requestAccounts" });
      if (!accounts || accounts.length === 0) throw new Error("No accounts found.");

      const bp = new ethers.BrowserProvider(p);
      const net = await bp.getNetwork();
      const cid = net.chainId.toString();
      const signer = await bp.getSigner();

      setProvider(p);
      setChainId(cid);
      setAccounts(accounts);
      setIsConnected(true);
      setEthersBrowserProvider(bp);
      setEthersSigner(signer);
      chainIdRef.current = cid;
      ethersSignerRef.current = signer;
    } catch (err: any) {
      setError(new Error(String(err?.message ?? err)));
      setIsConnected(false);
      setProvider(undefined);
      setChainId(undefined);
      setAccounts(undefined);
      setEthersBrowserProvider(undefined);
      setEthersSigner(undefined);
    }
  };

  useEffect(() => {
    const injected = detectProvider();
    if (!injected) return;

    const p = injected.provider;
    const handleAccountsChanged = (accs: string[]) => {
      if (accs.length === 0) {
        setIsConnected(false);
        setAccounts(undefined);
        setEthersBrowserProvider(undefined);
        setEthersSigner(undefined);
      } else {
        connect();
      }
    };

    const handleChainChanged = (cid: string) => {
      setChainId(cid);
      chainIdRef.current = cid;
      connect();
    };

    p.on("accountsChanged", handleAccountsChanged);
    p.on("chainChanged", handleChainChanged);

    // Auto-connect if accounts are already approved
    (async () => {
      try {
        const accounts = await p.request({ method: "eth_accounts" });
        if (accounts && accounts.length > 0) {
          await connect();
        }
      } catch (e) {
        console.warn("Auto-connect failed:", e);
      }
    })();

    return () => {
      p.removeListener("accountsChanged", handleAccountsChanged);
      p.removeListener("chainChanged", handleChainChanged);
    };
  }, []);

  return {
    provider,
    chainId,
    accounts,
    isConnected,
    error,
    connect,
    sameChain,
    sameSigner,
    ethersBrowserProvider,
    ethersSigner,
  };
}

const WalletEthersSignerContext = createContext<UseWalletEthersSignerState | undefined>(undefined);

interface WalletEthersSignerProviderProps {
  children: ReactNode;
}

export const WalletEthersSignerProvider: React.FC<WalletEthersSignerProviderProps> = ({ children }) => {
  const props = useWalletEthersSignerInternal();
  return (
    <WalletEthersSignerContext.Provider value={props}>
      {children}
    </WalletEthersSignerContext.Provider>
  );
};

export function useWalletEthersSigner() {
  const context = useContext(WalletEthersSignerContext);
  if (context === undefined) {
    throw new Error("useWalletEthersSigner must be used within a WalletEthersSignerProvider");
  }
  return context;
};