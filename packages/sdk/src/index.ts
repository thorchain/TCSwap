/**
 * Based on code from SwapKit (https://github.com/swapkit/SwapKit),
 * licensed under the Apache License 2.0.
 * Modifications © 2025 Horizontal Systems.
 */

// This should be cleared from unnecessary imports and migrate to:
// - `sdk/toolboxes`
// - `sdk/plugins`
// - `sdk/wallets`
import { type SKConfigState, USwap } from "@uswap/core";
import type { createPlugin } from "@uswap/plugins";
import { ChainflipPlugin } from "@uswap/plugins/chainflip";
import { EVMPlugin } from "@uswap/plugins/evm";
import { GardenPlugin } from "@uswap/plugins/garden";
import { NearPlugin } from "@uswap/plugins/near";
import { RadixPlugin } from "@uswap/plugins/radix";
import { SolanaPlugin } from "@uswap/plugins/solana";
import { MayachainPlugin, ThorchainPlugin } from "@uswap/plugins/thorchain";
import type { createWallet } from "@uswap/wallets";

import { bitgetWallet } from "@uswap/wallets/bitget";
import { coinbaseWallet } from "@uswap/wallets/coinbase";
import { ctrlWallet } from "@uswap/wallets/ctrl";
import { evmWallet } from "@uswap/wallets/evm-extensions";
import { keepkeyWallet } from "@uswap/wallets/keepkey";
import { keepkeyBexWallet } from "@uswap/wallets/keepkey-bex";
import { keplrWallet } from "@uswap/wallets/keplr";
import { keystoreWallet } from "@uswap/wallets/keystore";
import { ledgerWallet } from "@uswap/wallets/ledger";
import { walletSelectorWallet } from "@uswap/wallets/near-wallet-selector";
import { okxWallet } from "@uswap/wallets/okx";
import { onekeyWallet } from "@uswap/wallets/onekey";
import { passkeysWallet } from "@uswap/wallets/passkeys";
import { phantomWallet } from "@uswap/wallets/phantom";
import { polkadotWallet } from "@uswap/wallets/polkadotjs";
import { radixWallet } from "@uswap/wallets/radix";
import { talismanWallet } from "@uswap/wallets/talisman";
import { trezorWallet } from "@uswap/wallets/trezor";
import { tronlinkWallet } from "@uswap/wallets/tronlink";
import { vultisigWallet } from "@uswap/wallets/vultisig";
import { walletconnectWallet } from "@uswap/wallets/walletconnect";
import { xamanWallet } from "@uswap/wallets/xaman";

export * from "@uswap/core";
export * from "@uswap/helpers";
export * from "@uswap/helpers/api";
export * from "@uswap/plugins";
export * from "@uswap/plugins/chainflip";
export * from "@uswap/plugins/evm";
export * from "@uswap/plugins/near";
export * from "@uswap/plugins/radix";
export * from "@uswap/plugins/solana";
export * from "@uswap/plugins/thorchain";
export * from "@uswap/toolboxes";
export * from "@uswap/toolboxes/cosmos";
export * from "@uswap/toolboxes/evm";
export * from "@uswap/toolboxes/radix";
export * from "@uswap/toolboxes/solana";
export * from "@uswap/toolboxes/substrate";
export * from "@uswap/toolboxes/utxo";
export * from "@uswap/wallets";

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

export function createSwapKit<
  Plugins extends ReturnType<typeof createPlugin>,
  Wallets extends ReturnType<typeof createWallet>,
>({ config, plugins, wallets }: { config?: SKConfigState; plugins?: Plugins; wallets?: Wallets } = {}) {
  const mergedPlugins = { ...defaultPlugins, ...plugins };
  const mergedWallets = { ...defaultWallets, ...wallets };

  return USwap({ config: config, plugins: mergedPlugins, wallets: mergedWallets });
}
