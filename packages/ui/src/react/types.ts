/**
 * Modifications © 2025 Horizontal Systems.
 */

import type { AssetValue, Chain, ChainWallet, createUSwap, USwapConfigState, WalletOption } from "@tcswap/sdk";

export type KeystoreFile = { keystore: import("@tcswap/sdk/wallets").Keystore | null; file: File; chains: Chain[] };

export interface USwapState {
  uSwap: ReturnType<typeof createUSwap> | null;
  walletType: WalletOption | null;
  isWalletConnected: boolean;
  isConnectingWallet: boolean;

  setUSwap: (uSwap: ReturnType<typeof createUSwap> | null) => void;
  setWalletState: (state: { connected: boolean; type: WalletOption | null }) => void;
  setIsConnectingWallet: (isConnectingWallet: boolean) => void;
}

export type USwapWidgetProps = { config?: USwapConfigState };

export type UseSwapQuoteParams = { inputAsset: string | null; outputAsset: string | null; amount: string };

export type UseFilteredSortedAssetsFilters = {
  searchQuery?: string;
  selectedNetworks?: Chain[];
  includeBalances?: boolean;
};

export type BalanceDetails = { balance: AssetValue; wallet: ChainWallet<Chain>; chain: Chain; identifier: string };
