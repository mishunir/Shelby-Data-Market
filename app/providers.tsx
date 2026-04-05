"use client";

import { AptosWalletAdapterProvider } from "@aptos-labs/wallet-adapter-react";
import { Network } from "@aptos-labs/ts-sdk";
import { ShelbyClientProvider } from "@shelby-protocol/react";
import { ShelbyClient } from "@shelby-protocol/sdk/browser";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

const shelbyNetwork = Network.SHELBYNET;

export default function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(() => new QueryClient());
  const [shelbyClient] = useState(() => {
    const apiKey = process.env.NEXT_PUBLIC_SHELBY_API_KEY;
    return new ShelbyClient({
      network: shelbyNetwork,
      ...(apiKey
        ? {
            apiKey,
            indexer: { apiKey },
            rpc: { apiKey },
          }
        : {}),
    });
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ShelbyClientProvider client={shelbyClient}>
        <AptosWalletAdapterProvider
          autoConnect
          dappConfig={{ network: shelbyNetwork }}
          optInWallets={["Petra", "Continue with Apple", "Continue with Google"]}
        >
          {children}
        </AptosWalletAdapterProvider>
      </ShelbyClientProvider>
    </QueryClientProvider>
  );
}
