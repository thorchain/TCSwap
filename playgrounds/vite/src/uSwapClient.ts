/**
 * Modifications © 2025 Horizontal Systems.
 */

import { AssetValue, createUSwap, USwapConfig } from "@tcswap/sdk";

let uSwapClient: ReturnType<typeof createUSwap> | undefined;
let currentConfig: { walletConnectProjectId?: string; brokerEndpoint?: string; uSwap?: string } = {};

export const getUSwapClient = ({
  walletConnectProjectId,
  brokerEndpoint,
  uSwap,
}: {
  walletConnectProjectId?: string;
  brokerEndpoint?: string;
  uSwap?: string;
} = {}) => {
  const configChanged =
    currentConfig.walletConnectProjectId !== walletConnectProjectId ||
    currentConfig.brokerEndpoint !== brokerEndpoint ||
    currentConfig.uSwap !== uSwap;

  if (uSwapClient && !configChanged) {
    const { apiKeys, envs, integrations, apis, chains, feeMultipliers, requestOptions, rpcUrls, wallets } =
      USwapConfig.getState();

    return {
      config: { apiKeys, apis, chains, envs, feeMultipliers, integrations, requestOptions, rpcUrls, wallets },
      uSwapClient,
    };
  }

  if (configChanged && uSwapClient) {
    uSwapClient.disconnectAll();
    uSwapClient = undefined;
  }

  currentConfig = { brokerEndpoint, uSwap: uSwap, walletConnectProjectId };

  const config = {
    apiKeys: {
      keepKey: localStorage.getItem("keepkeyApiKey") || "1234",
      uSwap: uSwap || process.env.TEST_API_KEY || "",
      walletConnectProjectId: walletConnectProjectId || "",
      xaman: process.env.XAMAN_API_KEY || "",
    },
    envs: { isDev: true },
    integrations: {
      chainflip: { brokerUrl: brokerEndpoint || "" },
      keepKey: {
        basePath: "http://localhost:1646/spec/swagger.json",
        imageUrl: "https://repository-images.githubusercontent.com/587472295/feec8a61-39b2-4615-b293-145e97f49b5a",
        name: "uSwap-demo-app",
        url: "http://localhost:1646",
      },
    },
  };

  uSwapClient = createUSwap({ config });

  return { config, uSwapClient };
};

export const resetUSwapClient = () => {
  if (uSwapClient) {
    uSwapClient.disconnectAll();
  }
  uSwapClient = undefined;
  currentConfig = {};
};

await AssetValue.loadStaticAssets();

export type USwapClient = ReturnType<typeof getUSwapClient>["uSwapClient"];
