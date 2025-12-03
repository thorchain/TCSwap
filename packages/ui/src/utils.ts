/**
 * Modifications © 2025 Horizontal Systems.
 */

import {
  loadPlugin,
  loadWallet,
  type PluginName,
  USwap,
  type USwapConfigState,
  USwapError,
  type USwapPlugins,
  type WalletOption,
} from "@uswap/sdk";

export async function getUSClient<W extends WalletOption, P extends PluginName[]>({
  walletOption,
  pluginNames,
}: {
  walletOption: W;
  pluginNames: P;
}): Promise<{ client: ReturnType<typeof USwap>; connectMethod: string }> {
  const connectedPlugins = await loadPlugins(pluginNames);
  const walletPkg = await loadWallet(walletOption);
  const connectMethod = Object.keys(walletPkg).find((key) => key.startsWith("connect"));
  if (!connectMethod) {
    throw new USwapError("core_wallet_connection_not_found", { walletOption });
  }

  return {
    client: USwap({ plugins: connectedPlugins, wallets: { ...walletPkg } }) as ReturnType<typeof USwap>,
    connectMethod,
  };
}

export async function loadPlugins<P extends PluginName[]>(pluginNames: P): Promise<Pick<USwapPlugins, P[number]>> {
  let connectedPlugins = {} as Pick<USwapPlugins, P[number]>;

  if (pluginNames?.length) {
    for (const pluginName of pluginNames) {
      const plugin = await loadPlugin(pluginName);
      connectedPlugins = { ...connectedPlugins, ...plugin };
    }
  }

  return connectedPlugins;
}

export const getStableConfigMemoKey = (config: USwapConfigState | undefined) => {
  if (!config) return null;

  try {
    return JSON.stringify(config);
  } catch (error) {
    console.error("Failed to get stable config memo key:", error);
    return null;
  }
};
