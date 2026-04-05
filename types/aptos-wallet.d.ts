export {};

declare global {
  interface AptosWalletAccount {
    address: string;
    publicKey?: string;
  }

  interface AptosWalletProvider {
    connect: () => Promise<AptosWalletAccount>;
    disconnect: () => Promise<void>;
    account: () => Promise<AptosWalletAccount>;
    isConnected?: () => Promise<boolean> | boolean;
  }

  interface Window {
    aptos?: AptosWalletProvider;
  }
}
