/**
 * Modifications © 2025 Horizontal Systems.
 */

// This should be cleared from unnecessary imports and migrate to:
// - `sdk/toolboxes`
// - `sdk/plugins`
// - `sdk/wallets`
import { USwap, type USwapConfigState } from "@tcswap/core";
import type { createPlugin } from "@tcswap/plugins";
import { ChainflipPlugin } from "@tcswap/plugins/chainflip";
import { EVMPlugin } from "@tcswap/plugins/evm";
import { GardenPlugin } from "@tcswap/plugins/garden";
import { NearPlugin } from "@tcswap/plugins/near";
import { RadixPlugin } from "@tcswap/plugins/radix";
import { SolanaPlugin } from "@tcswap/plugins/solana";
import { MayachainPlugin, ThorchainPlugin } from "@tcswap/plugins/thorchain";
import type { createWallet } from "@tcswap/wallets";

import { bitgetWallet } from "@tcswap/wallets/bitget";
import { coinbaseWallet } from "@tcswap/wallets/coinbase";
import { ctrlWallet } from "@tcswap/wallets/ctrl";
import { evmWallet } from "@tcswap/wallets/evm-extensions";
import { keepkeyWallet } from "@tcswap/wallets/keepkey";
import { keepkeyBexWallet } from "@tcswap/wallets/keepkey-bex";
import { keplrWallet } from "@tcswap/wallets/keplr";
import { keystoreWallet } from "@tcswap/wallets/keystore";
import { ledgerWallet } from "@tcswap/wallets/ledger";
import { walletSelectorWallet } from "@tcswap/wallets/near-wallet-selector";
import { okxWallet } from "@tcswap/wallets/okx";
import { onekeyWallet } from "@tcswap/wallets/onekey";
import { passkeysWallet } from "@tcswap/wallets/passkeys";
import { phantomWallet } from "@tcswap/wallets/phantom";
import { polkadotWallet } from "@tcswap/wallets/polkadotjs";
import { radixWallet } from "@tcswap/wallets/radix";
import { talismanWallet } from "@tcswap/wallets/talisman";
import { trezorWallet } from "@tcswap/wallets/trezor";
import { tronlinkWallet } from "@tcswap/wallets/tronlink";
import { vultisigWallet } from "@tcswap/wallets/vultisig";
import { walletconnectWallet } from "@tcswap/wallets/walletconnect";
import { xamanWallet } from "@tcswap/wallets/xaman";

export * from "@tcswap/core";
export * from "@tcswap/helpers";
export * from "@tcswap/helpers/api";
export * from "@tcswap/plugins";
export * from "@tcswap/plugins/chainflip";
export * from "@tcswap/plugins/evm";
export * from "@tcswap/plugins/near";
export * from "@tcswap/plugins/radix";
export * from "@tcswap/plugins/solana";
export * from "@tcswap/plugins/thorchain";
export * from "@tcswap/toolboxes";
export * from "@tcswap/toolboxes/cosmos";
export * from "@tcswap/toolboxes/evm";
export * from "@tcswap/toolboxes/radix";
export * from "@tcswap/toolboxes/solana";
export * from "@tcswap/toolboxes/substrate";
export * from "@tcswap/toolboxes/utxo";
export * from "@tcswap/wallets";

const exodusWallet = { ...passkeysWallet, connectExodusWallet: passkeysWallet.connectPasskeys };

export {
  bitgetWallet,
  coinbaseWallet,
  ctrlWallet,
  evmWallet,
  exodusWallet,
  keepkeyBexWallet,
  keepkeyWallet,
  keplrWallet,
  keystoreWallet,
  ledgerWallet,
  okxWallet,
  onekeyWallet,
  passkeysWallet,
  phantomWallet,
  polkadotWallet,
  radixWallet,
  talismanWallet,
  trezorWallet,
  tronlinkWallet,
  vultisigWallet,
  walletSelectorWallet,
  walletconnectWallet,
  xamanWallet,
};

export const defaultPlugins = {
  ...ChainflipPlugin,
  ...EVMPlugin,
  ...MayachainPlugin,
  ...ThorchainPlugin,
  ...RadixPlugin,
  ...SolanaPlugin,
  ...NearPlugin,
  ...GardenPlugin,
};

export const defaultWallets = {
  ...bitgetWallet,
  ...coinbaseWallet,
  ...ctrlWallet,
  ...evmWallet,
  ...exodusWallet,
  ...keepkeyBexWallet,
  ...keepkeyWallet,
  ...keplrWallet,
  ...keystoreWallet,
  ...ledgerWallet,
  ...okxWallet,
  ...onekeyWallet,
  ...phantomWallet,
  ...polkadotWallet,
  ...passkeysWallet,
  ...radixWallet,
  ...talismanWallet,
  ...trezorWallet,
  ...tronlinkWallet,
  ...vultisigWallet,
  ...walletSelectorWallet,
  ...walletconnectWallet,
  ...xamanWallet,
} as ReturnType<typeof createWallet>;

export function createUSwap<
  Plugins extends ReturnType<typeof createPlugin>,
  Wallets extends ReturnType<typeof createWallet>,
>({ config, plugins, wallets }: { config?: USwapConfigState; plugins?: Plugins; wallets?: Wallets } = {}) {
  const mergedPlugins = { ...defaultPlugins, ...plugins };
  const mergedWallets = { ...defaultWallets, ...wallets };

  return USwap({ config: config, plugins: mergedPlugins, wallets: mergedWallets });
}
