import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { WalletEthersSignerProvider } from '../components/useWalletEthersSigner';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <WalletEthersSignerProvider>
      <Component {...pageProps} />
    </WalletEthersSignerProvider>
  );
}