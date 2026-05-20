/**
 * Modifications © 2025 Horizontal Systems.
 */

import {
  Chain,
  ChainId,
  ChainToChainId,
  type EVMChain,
  EVMChains,
  filterSupportedChains,
  USwapError,
  WalletOption,
} from "@tcswap/helpers";
import { createWallet, getWalletSupportedChains } from "@tcswap/wallet-core";
import type { Eip1193Provider } from "ethers";
import { chainRegistry } from "./chainRegistry";

const keplrSupportedChainIds = [ChainId.Cosmos, ChainId.Kujira, ChainId.Noble, ChainId.THORChain] as const;
const keplrCosmosChains = [Chain.Cosmos, Chain.Kujira, Chain.Noble, Chain.THORChain] as const;

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
          if (EVMChains.includes(chain as EVMChain)) {
            const ethereumProvider = keplrClient?.ethereum as unknown as Eip1193Provider | undefined;
            if (!ethereumProvider) throw new USwapError("wallet_keplr_chain_not_supported", { chain });

            const { BrowserProvider } = await import("ethers");
            const { getWeb3WalletMethods } = await import("../evm-extensions");

            const browserProvider = new BrowserProvider(ethereumProvider, "any");
            await browserProvider.send("eth_requestAccounts", []);
            const signer = await browserProvider.getSigner();
            const address = await signer.getAddress();

            const walletMethods = await getWeb3WalletMethods({
              address,
              chain: chain as EVMChain,
              provider: browserProvider,
              walletProvider: ethereumProvider,
            });

            const disconnect = () => browserProvider.send("wallet_revokePermissions", [{ eth_accounts: {} }]);
            addChain({ ...walletMethods, address, chain, disconnect, walletType });
            return;
          }

          const chainId = ChainToChainId[chain] as (typeof keplrSupportedChainIds)[number];

          if (!keplrSupportedChainIds.includes(chainId)) {
            const chainConfig = chainRegistry.get(chainId);
            if (!chainConfig) throw new USwapError("wallet_keplr_chain_not_supported", { chain });

            await keplrClient.experimentalSuggestChain(chainConfig);
          }

          keplrClient?.enable(chainId);
          const signer = keplrClient?.getOfflineSignerOnlyAmino(chainId);
          if (!signer) throw new USwapError("wallet_keplr_signer_not_found");

          const { getCosmosToolbox } = await import("@tcswap/toolboxes/cosmos");

          const accounts = await signer.getAccounts();
          if (!accounts?.[0]?.address) throw new USwapError("wallet_keplr_no_accounts");

          const [{ address }] = accounts;
          const toolbox = await getCosmosToolbox(chain as (typeof keplrCosmosChains)[number], { signer });

          addChain({ ...toolbox, address, chain, walletType });
        }),
      );

      return true;
    },
  name: "connectKeplr",
  supportedChains: [...keplrCosmosChains, ...EVMChains],
});

export const KEPLR_SUPPORTED_CHAINS = getWalletSupportedChains(keplrWallet);
