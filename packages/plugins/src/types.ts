/**
 * Modifications © 2025 Horizontal Systems.
 */

import type { Chain } from "@tcswap/helpers";
import type { FullWallet } from "@tcswap/toolboxes";
import type { ChainflipPlugin } from "./chainflip";
import type { EVMPlugin } from "./evm";
import type { NearPlugin } from "./near";
import type { RadixPlugin } from "./radix";
import type { SolanaPlugin } from "./solana/plugin";
import type { ThorchainPlugin } from "./thorchain";

export type * from "./chainflip/types";
export type * from "./thorchain/types";

export type USwapPlugins = typeof ChainflipPlugin &
  typeof ThorchainPlugin &
  typeof RadixPlugin &
  typeof SolanaPlugin &
  typeof EVMPlugin &
  typeof NearPlugin;

export type PluginName = keyof USwapPlugins;

export type SwapKitPluginParams = { getWallet: <T extends Chain>(chain: T) => FullWallet[T] };
