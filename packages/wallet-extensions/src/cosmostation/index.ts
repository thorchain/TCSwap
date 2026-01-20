/**
 * Modifications © 2025 Horizontal Systems.
 */

import type { Keplr } from "@keplr-wallet/types";
import { Chain, ChainId, ChainToChainId, filterSupportedChains, USwapError, WalletOption } from "@tcswap/helpers";
import { createWallet, getWalletSupportedChains } from "@tcswap/wallet-core";

const cosmostationSupportedChainIds = [ChainId.Cosmos, ChainId.Kujira, ChainId.Noble, ChainId.THORChain] as const;
const cosmostationSupportedEVMChains = [
  Chain.Ethereum,
  Chain.BinanceSmartChain,
  Chain.Avalanche,
  Chain.Polygon,
  Chain.Arbitrum,
  Chain.Optimism,
  Chain.Base,
  Chain.XLayer,
] as const;

declare global {
  interface Window {
    cosmostation?: { providers?: { keplr?: Keplr } };
  }
}

async function connectCosmosChains(chains: Chain[], addChain: any, keplrProvider: Keplr) {
  await Promise.all(
    chains.map(async (chain) => {
      const chainId = ChainToChainId[chain] as (typeof cosmostationSupportedChainIds)[number];

      await keplrProvider.enable(chainId);
      const signer = keplrProvider.getOfflineSignerOnlyAmino(chainId);
      if (!signer) throw new USwapError("wallet_cosmostation_signer_not_found");

      const { getCosmosToolbox } = await import("@tcswap/toolboxes/cosmos");

      const accounts = await signer.getAccounts();
      if (!accounts?.[0]?.address) throw new USwapError("wallet_cosmostation_no_accounts");

      const [{ address }] = accounts;
      const toolbox = await getCosmosToolbox(chain as any, { signer });

      addChain({ ...toolbox, address, chain, walletType: WalletOption.COSMOSTATION });
    }),
  );
}

async function connectEvmChains(chains: Chain[], addChain: any) {
  const provider = window.ethereum;

  if (!provider) {
    throw new USwapError("wallet_cosmostation_evm_provider_not_found");
  }

  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];

  if (!accounts || accounts.length === 0) {
    throw new USwapError("wallet_cosmostation_no_evm_accounts");
  }

  const { getEvmToolbox } = await import("@tcswap/toolboxes/evm");

  for (const chain of chains) {
    const toolbox = getEvmToolbox(chain as any, { provider });
    const [address] = accounts;

    if (!address) {
      throw new USwapError("wallet_cosmostation_no_evm_address");
    }

    addChain({ ...toolbox, address, chain, walletType: WalletOption.COSMOSTATION });
  }
}

export const cosmostationWallet = createWallet({
  connect: ({ addChain, supportedChains }) =>
    async function connectCosmostation(chains: Chain[]) {
      const filteredChains = filterSupportedChains({ chains, supportedChains, walletType: WalletOption.COSMOSTATION });

      if (!window.cosmostation) {
        throw new USwapError("wallet_cosmostation_not_found");
      }

      const cosmosChains = filteredChains.filter((chain) =>
        cosmostationSupportedChainIds.includes(ChainToChainId[chain] as any),
      );
      const evmChains = filteredChains.filter((chain) => cosmostationSupportedEVMChains.includes(chain as any));

      if (cosmosChains.length > 0) {
        const keplrProvider = window.cosmostation.providers?.keplr;
        if (!keplrProvider) {
          throw new USwapError("wallet_cosmostation_keplr_provider_not_found");
        }

        await connectCosmosChains(cosmosChains, addChain, keplrProvider);
      }

      if (evmChains.length > 0) {
        await connectEvmChains(evmChains, addChain);
      }

      return true;
    },
  name: "connectCosmostation",
  supportedChains: [
    Chain.Cosmos,
    Chain.Kujira,
    Chain.Noble,
    Chain.THORChain,
    Chain.Ethereum,
    Chain.BinanceSmartChain,
    Chain.Avalanche,
    Chain.Polygon,
    Chain.Arbitrum,
    Chain.Optimism,
    Chain.Base,
    Chain.XLayer,
  ],
});

export const COSMOSTATION_SUPPORTED_CHAINS = getWalletSupportedChains(cosmostationWallet);
