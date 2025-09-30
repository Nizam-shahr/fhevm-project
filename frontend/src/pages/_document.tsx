import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html>
      <Head>
        <script type="module" dangerouslySetInnerHTML={{
          __html: `
            import * as RelaySDK from "https://cdn.zama.ai/relayer-sdk-js/0.2.0/relayer-sdk-js.js";
            window.RelaySDK = RelaySDK;
          `
        }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}