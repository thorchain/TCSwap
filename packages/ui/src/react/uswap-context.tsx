/**
 * Modifications © 2025 Horizontal Systems.
 */

"use client";

import type { Chain, EVMChain, TokenNames, USwapConfigState } from "@uswap/sdk";
import { AssetValue, NetworkDerivationPath, WalletOption } from "@uswap/sdk";
import { useCallback, useEffect, useMemo } from "react";
import { create } from "zustand";
import type { BalanceDetails, KeystoreFile, USwapState } from "./types";

const useUSwapStore = create<USwapState>((set) => {
  // biome-ignore assist/source/useSortedKeys: sort by variable type/use case, not alphabetically
  return {
    uSwap: null,

    balances: [],
    walletType: null,
    isConnectingWallet: false,
    isWalletConnected: false,

    setUSwap: (uSwap) => set({ uSwap }),
    setWalletState: ({ connected, type }) => set({ isWalletConnected: connected, walletType: type }),
    setIsConnectingWallet: (isConnectingWallet) => set({ isConnectingWallet }),
  };
});

await AssetValue.loadStaticAssets();

export const assetsMap = new Map<TokenNames | (string & {}), AssetValue>(
  Array.from(AssetValue.staticAssets.keys()).map((identifier) => [
    identifier,
    AssetValue.from({ asset: identifier as TokenNames }),
  ]),
);

export const useUSwap = () => {
  const { uSwap, walletType, isWalletConnected, isConnectingWallet, setUSwap, setWalletState, setIsConnectingWallet } =
    useUSwapStore((state) => state);

  // biome-ignore lint/correctness/useExhaustiveDependencies: biome is bugging out
  useEffect(() => {
    if (uSwap) return;

    void loadUSwap();
  }, []);

  const loadUSwap = useCallback(
    async (params?: { config: USwapConfigState | undefined }) => {
      const { createUSwap } = await import("@uswap/sdk");

      const uSwapClient = createUSwap({ config: params?.config });

      setUSwap(uSwapClient);
    },
    [setUSwap],
  );

  const connectWallet = useCallback(
    async (option: WalletOption, chains: Chain[]) => {
      setIsConnectingWallet(true);
      setWalletState({ connected: false, type: option });

      try {
        switch (option) {
          case WalletOption.METAMASK:
          case WalletOption.COINBASE_WEB:
          case WalletOption.TRUSTWALLET_WEB:
            await uSwap?.connectEVMWallet?.(chains as EVMChain[]);
            break;

          case WalletOption.PHANTOM:
            await uSwap?.connectPhantom?.(chains);
            break;

          case WalletOption.KEPLR:
            await uSwap?.connectKeplr?.(chains);
            break;

          case WalletOption.LEDGER:
            await uSwap?.connectLedger?.(chains);
            break;

          case WalletOption.TREZOR: {
            const [chain] = chains;
            if (!chain) throw new Error("Chain is required for Trezor");
            await uSwap?.connectTrezor?.(chains, NetworkDerivationPath[chain]);
            break;
          }

          case WalletOption.WALLETCONNECT:
            await uSwap?.connectWalletconnect?.(chains);
            break;

          case WalletOption.COINBASE_MOBILE:
            await uSwap?.connectCoinbaseWallet?.(chains);
            break;

          case WalletOption.BITGET:
            await uSwap?.connectBitget?.(chains);
            break;

          case WalletOption.CTRL:
            await uSwap?.connectCtrl?.(chains);
            break;

          case WalletOption.KEEPKEY:
            await uSwap?.connectKeepkey?.(chains);
            break;

          case WalletOption.KEEPKEY_BEX:
            await uSwap?.connectKeepkeyBex?.(chains);
            break;

          case WalletOption.ONEKEY:
            await uSwap?.connectOnekeyWallet?.(chains);
            break;

          case WalletOption.KEYSTORE:
            // Keystore handling is moved to the KeystoreHandler component
            break;

          case WalletOption.OKX:
          case WalletOption.OKX_MOBILE:
            await uSwap?.connectOkx?.(chains);
            break;

          case WalletOption.POLKADOT_JS:
            await uSwap?.connectPolkadotJs?.(chains);
            break;

          case WalletOption.RADIX_WALLET:
            await uSwap?.connectRadixWallet?.(chains);
            break;

          case WalletOption.TALISMAN:
            await uSwap?.connectTalisman?.(chains);
            break;

          default:
            throw new Error(`Unsupported wallet option: ${option}`);
        }

        const isConnected = chains.some((chain) => !!uSwap?.getAddress(chain));

        if (!isConnected) throw new Error("Failed to connect wallet");

        setWalletState({ connected: isConnected, type: option });

        await Promise.allSettled(chains.map((chain) => uSwap?.getWalletWithBalance(chain)));

        setUSwap(uSwap);
      } catch (error) {
        console.error(`Failed to connect ${option}:`, error);

        setWalletState({ connected: false, type: null });

        throw new Error(`Failed to connect ${option}: ${error instanceof Error ? error.message : "Unknown error"}`);
      } finally {
        setIsConnectingWallet(false);
      }
    },
    [setWalletState, uSwap, setIsConnectingWallet, setUSwap],
  );

  const disconnectWallet = useCallback(() => {
    uSwap?.disconnectAll();
    setWalletState({ connected: false, type: null });
  }, [uSwap, setWalletState]);

  const checkIfChainConnected = useCallback((chain: Chain) => !!uSwap?.getAddress(chain), [uSwap]);

  const connectKeystore = useCallback(
    async (keystoreFile: KeystoreFile, password: string) => {
      if (!keystoreFile?.keystore || !uSwap) return;

      try {
        setIsConnectingWallet(true);

        const { decryptFromKeystore } = await import("@uswap/wallet-keystore");
        const phrase = await decryptFromKeystore(keystoreFile.keystore, password);

        if (!phrase) throw new Error("Failed to decrypt keystore");

        await uSwap?.connectKeystore?.(keystoreFile.chains, phrase);

        setWalletState({ connected: true, type: WalletOption.KEYSTORE });

        await Promise.allSettled(keystoreFile.chains.map((balance) => uSwap?.getWalletWithBalance(balance)));
      } catch (error) {
        console.error("Failed to decrypt keystore:", error);
        throw new Error("Failed to decrypt keystore");
      } finally {
        setIsConnectingWallet(false);
      }
    },
    [uSwap, setWalletState, setIsConnectingWallet],
  );

  const stableWalletsMemoKey = Object.entries(uSwap?.getAllWallets?.() || {})
    .map(([chain, wallet]) => `${chain}:${wallet?.balance?.map((bal) => bal.toString()).join("_")}`)
    .join(",");

  // biome-ignore lint/correctness/useExhaustiveDependencies: uses stable memo key for performance reasons
  const balancesByChain = useMemo(() => {
    const balancesByChain = new Map<Chain, BalanceDetails[]>();

    Object.values(uSwap?.getAllWallets?.() || {})?.forEach((wallet) => {
      wallet?.balance?.forEach((balance) => {
        const balances = balancesByChain.get(wallet.chain) || [];

        balances.push({ balance, chain: wallet.chain, identifier: balance.toString(), wallet });

        balancesByChain.set(wallet.chain, balances);
      });
    });

    return balancesByChain;
  }, [stableWalletsMemoKey]);

  return useMemo(
    // biome-ignore assist/source/useSortedKeys: sort by variable type/use case, not alphabetically
    () => ({
      uSwap,
      loadUSwap,

      balancesByChain,
      isWalletConnected,
      isConnectingWallet,
      walletType,

      checkIfChainConnected,
      connectKeystore,
      connectWallet,
      disconnectWallet,
    }),
    [
      uSwap,
      balancesByChain,
      isWalletConnected,
      isConnectingWallet,
      walletType,
      checkIfChainConnected,
      connectKeystore,
      connectWallet,
      disconnectWallet,
      loadUSwap,
    ],
  );
};
