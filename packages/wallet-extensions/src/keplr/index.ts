/**
 * Modifications © 2025 Horizontal Systems.
 */

import { Chain, ChainId, ChainToChainId, filterSupportedChains, USwapError, WalletOption } from "@uswap/helpers";
import { createWallet, getWalletSupportedChains } from "@uswap/wallet-core";
import { chainRegistry } from "./chainRegistry";

const keplrSupportedChainIds = [ChainId.Cosmos, ChainId.Kujira, ChainId.Noble, ChainId.THORChain] as const;

export const keplrWallet = createWallet({
  connect: ({ addChain, supportedChains }) =>
    async function connectKeplr(
      chains: Chain[],
      walletType: WalletOption.KEPLR | WalletOption.LEAP = WalletOption.KEPLR,
    ) {
      const extensionKey = walletType === WalletOption.LEAP ? "leap" : "keplr";
      const filteredChains = filterSupportedChains({ chains, supportedChains, walletType });
      const keplrClient = window[extensionKey];

      await Promise.all(
        filteredChains.map(async (chain) => {
          const chainId = ChainToChainId[chain] as (typeof keplrSupportedChainIds)[number];

          if (!keplrSupportedChainIds.includes(chainId)) {
            const chainConfig = chainRegistry.get(chainId);
            if (!chainConfig) throw new USwapError("wallet_keplr_chain_not_supported", { chain });

            await keplrClient.experimentalSuggestChain(chainConfig);
          }

          keplrClient?.enable(chainId);
          const signer = keplrClient?.getOfflineSignerOnlyAmino(chainId);
          if (!signer) throw new USwapError("wallet_keplr_signer_not_found");

          const { getCosmosToolbox } = await import("@uswap/toolboxes/cosmos");

          const accounts = await signer.getAccounts();
          if (!accounts?.[0]?.address) throw new USwapError("wallet_keplr_no_accounts");

          const [{ address }] = accounts;
          const toolbox = await getCosmosToolbox(chain, { signer });

          addChain({ ...toolbox, address, chain, walletType });
        }),
      );

      return true;
    },
  name: "connectKeplr",
  supportedChains: [Chain.Cosmos, Chain.Kujira, Chain.Noble, Chain.THORChain],
});

export const KEPLR_SUPPORTED_CHAINS = getWalletSupportedChains(keplrWallet);
