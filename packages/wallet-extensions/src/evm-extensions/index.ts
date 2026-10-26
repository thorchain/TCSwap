/**
 * Modifications © 2025 Horizontal Systems.
 */

import {
  type Chain,
  type EVMChain,
  EVMChains,
  filterSupportedChains,
  getEIP6963Provider,
  getMetaMaskProvider,
  prepareNetworkSwitch,
  RABBY_RDNS,
  USwapError,
  WalletOption,
} from "@tcswap/helpers";
import { createWallet, getWalletSupportedChains } from "@tcswap/wallet-core";
import type { BrowserProvider, Eip1193Provider } from "ethers";

export type EVMWalletOptions =
  | WalletOption.BRAVE
  | WalletOption.OKX_MOBILE
  | WalletOption.METAMASK
  | WalletOption.RABBY
  | WalletOption.TRUSTWALLET_WEB
  | WalletOption.COINBASE_WEB
  | WalletOption.EIP6963;

const getWalletForType = (
  walletType:
    | WalletOption.BRAVE
    | WalletOption.OKX_MOBILE
    | WalletOption.METAMASK
    | WalletOption.RABBY
    | WalletOption.TRUSTWALLET_WEB
    | WalletOption.COINBASE_WEB
    | WalletOption.EIP6963,
) => {
  switch (walletType) {
    case WalletOption.COINBASE_WEB:
      return window.coinbaseWalletExtension;
    case WalletOption.TRUSTWALLET_WEB:
      return window.trustwallet;
    case WalletOption.METAMASK:
      return getMetaMaskProvider();
    // Rabby's own provider: `window.ethereum` is MetaMask's unless Rabby is set as the default wallet.
    case WalletOption.RABBY:
      return getEIP6963Provider(RABBY_RDNS) ?? (window.ethereum?.isRabby ? window.ethereum : undefined);
    default:
      return window.ethereum;
  }
};

export const getWeb3WalletMethods = async ({
  address,
  walletProvider,
  chain,
  provider,
}: {
  address: string;
  walletProvider?: Eip1193Provider;
  chain: EVMChain;
  provider: BrowserProvider;
}) => {
  if (!walletProvider) throw new USwapError("wallet_evm_extensions_not_found");
  const { getEvmToolbox } = await import("@tcswap/toolboxes/evm");

  const signer = await provider.getSigner();
  const toolbox = await getEvmToolbox(chain, { provider, signer });

  // No switch on connect (one prompt per chain in Brave and Exodus); wrapped methods switch on demand.
  return prepareNetworkSwitch({
    chain,
    networkParams: toolbox.getNetworkParams(),
    provider,
    toolbox: { ...toolbox, getBalance: () => toolbox.getBalance(address) },
  });
};

export const evmWallet = createWallet({
  connect: ({ addChain, supportedChains }) =>
    async function connectEVMWallet(chains: Chain[], type?: EVMWalletOptions, eip1193Provider?: Eip1193Provider) {
      // Without a type, `window.ethereum` is used whoever injected it (and filed as MetaMask), as before;
      // an explicit METAMASK finds MetaMask itself, so it never connects Rabby holding `window.ethereum`.
      const walletType = type ?? WalletOption.METAMASK;
      const filteredChains = filterSupportedChains({ chains, supportedChains, walletType });
      const { BrowserProvider } = await import("ethers");

      await Promise.all(
        filteredChains.map(async (chain) => {
          if (walletType === WalletOption.EIP6963 && !eip1193Provider)
            throw new USwapError("wallet_evm_extensions_no_provider");

          const windowProvider = eip1193Provider || (type ? getWalletForType(type) : window.ethereum);
          if (!windowProvider) throw new USwapError("wallet_evm_extensions_not_found");
          const browserProvider = new BrowserProvider(windowProvider, "any");

          await browserProvider.send("eth_requestAccounts", []);
          const signer = await browserProvider.getSigner();
          const address = await signer.getAddress();

          const walletMethods = await getWeb3WalletMethods({
            address,
            chain,
            provider: browserProvider,
            walletProvider: windowProvider,
          });

          const disconnect = () => browserProvider.send("wallet_revokePermissions", [{ eth_accounts: {} }]);
          addChain({ ...walletMethods, address, chain, disconnect, walletType });
          return;
        }),
      );

      return true;
    },
  name: "connectEVMWallet",
  supportedChains: [...EVMChains] as EVMChain[],
});

export const EVM_EXTENSIONS_SUPPORTED_CHAINS = getWalletSupportedChains(evmWallet);
