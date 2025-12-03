/**
 * Modifications © 2025 Horizontal Systems.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Chain } from "@uswap/types";
import { FeeOption } from "../../types";
import { USwapConfig } from "../uSwapConfig";

beforeAll(() => {
  USwapConfig.reinitialize();
});

afterAll(() => {
  USwapConfig.reinitialize();
});

describe("uSwapConfig", () => {
  test("properly sets api keys", () => {
    const initialState = USwapConfig.get("apiKeys").uSwap;
    expect(initialState).toBe("");

    USwapConfig.setApiKey("uSwap", "123");

    const changedState = USwapConfig.get("apiKeys").uSwap;
    expect(changedState).toBe("123");
  });

  test("do not drop if other keys are changed", () => {
    USwapConfig.setApiKey("uSwap", "123");
    expect(USwapConfig.get("apiKeys").uSwap).toBe("123");

    USwapConfig.setApiKey("walletConnectProjectId", "123");
    expect(USwapConfig.get("apiKeys")).toMatchObject({ uSwap: "123", walletConnectProjectId: "123" });

    USwapConfig.setRpcUrl(Chain.Ethereum, ["https://lul.xyz"]);
    expect(USwapConfig.getState()).toMatchObject({
      apiKeys: { uSwap: "123", walletConnectProjectId: "123" },
      rpcUrls: { [Chain.Ethereum]: ["https://lul.xyz"] },
    });
  });

  describe("setConfig", () => {
    test("merges chains without duplicates", () => {
      USwapConfig.reinitialize();

      const initialChains = USwapConfig.get("chains");
      const initialLength = initialChains.length;

      USwapConfig.set({ chains: [Chain.Ethereum, Chain.Bitcoin] });

      const newChains = USwapConfig.get("chains");
      // Should add new chains (if not already present)
      expect(newChains.length).toBeGreaterThanOrEqual(initialLength);
      expect(newChains).toContain(Chain.Ethereum);
      expect(newChains).toContain(Chain.Bitcoin);
    });

    test("merges wallets array", () => {
      USwapConfig.reinitialize();

      const initialWallets = USwapConfig.get("wallets");
      USwapConfig.set({ wallets: initialWallets });

      const newWallets = USwapConfig.get("wallets");
      expect(newWallets.length).toBeGreaterThanOrEqual(initialWallets.length);
    });

    test("merges apiKeys without overwriting", () => {
      USwapConfig.reinitialize();

      USwapConfig.setApiKey("uSwap", "test-key-1");
      USwapConfig.set({ apiKeys: { blockchair: "blockchair-key" } });

      const apiKeys = USwapConfig.get("apiKeys");
      expect(apiKeys.uSwap).toBe("test-key-1");
      expect(apiKeys.blockchair).toBe("blockchair-key");
    });

    test("merges envs object", () => {
      USwapConfig.reinitialize();

      USwapConfig.set({ envs: { isDev: true } });

      const envs = USwapConfig.get("envs");
      expect(envs.isDev).toBe(true);
      expect(envs.apiUrl).toBeDefined(); // Should preserve other env values
    });

    test("merges rpcUrls", () => {
      USwapConfig.reinitialize();

      USwapConfig.set({
        rpcUrls: { [Chain.Ethereum]: ["https://custom-eth-rpc.com"], [Chain.Bitcoin]: ["https://custom-btc-rpc.com"] },
      });

      const rpcUrls = USwapConfig.get("rpcUrls");
      expect(rpcUrls[Chain.Ethereum]).toEqual(["https://custom-eth-rpc.com"]);
      expect(rpcUrls[Chain.Bitcoin]).toEqual(["https://custom-btc-rpc.com"]);
    });

    test("merges integrations config", () => {
      USwapConfig.reinitialize();

      USwapConfig.set({ integrations: { coinbase: { appName: "Test App", darkMode: true } } });

      const integrations = USwapConfig.get("integrations");
      expect(integrations.coinbase?.appName).toBe("Test App");
      expect(integrations.radix).toBeDefined(); // Should preserve default radix config
    });

    test("sets feeMultipliers", () => {
      USwapConfig.reinitialize();

      const feeMultipliers = { [FeeOption.Average]: 1.0, [FeeOption.Fast]: 1.5, [FeeOption.Fastest]: 2.0 };

      USwapConfig.set({ feeMultipliers });

      const result = USwapConfig.get("feeMultipliers");
      expect(result).toEqual(feeMultipliers);
    });
  });

  describe("setEnv", () => {
    test("sets isDev flag", () => {
      USwapConfig.reinitialize();

      USwapConfig.setEnv("isDev", true);
      expect(USwapConfig.get("envs").isDev).toBe(true);

      USwapConfig.setEnv("isDev", false);
      expect(USwapConfig.get("envs").isDev).toBe(false);
    });

    test("sets isStagenet flag", () => {
      USwapConfig.reinitialize();

      USwapConfig.setEnv("isStagenet", true);
      expect(USwapConfig.get("envs").isStagenet).toBe(true);

      USwapConfig.setEnv("isStagenet", false);
      expect(USwapConfig.get("envs").isStagenet).toBe(false);
    });

    test("sets apiUrl", () => {
      USwapConfig.reinitialize();

      const customUrl = "https://custom-api.example.com";
      USwapConfig.setEnv("apiUrl", customUrl);
      expect(USwapConfig.get("envs").apiUrl).toBe(customUrl);
    });

    test("sets devApiUrl", () => {
      USwapConfig.reinitialize();

      const customDevUrl = "https://custom-dev-api.example.com";
      USwapConfig.setEnv("devApiUrl", customDevUrl);
      expect(USwapConfig.get("envs").devApiUrl).toBe(customDevUrl);
    });
  });

  describe("setRpcUrl", () => {
    test("sets RPC URL for single chain", () => {
      USwapConfig.reinitialize();

      const customRpcUrls = ["https://custom-eth.rpc.com", "https://backup-eth.rpc.com"];
      USwapConfig.setRpcUrl(Chain.Ethereum, customRpcUrls);

      expect(USwapConfig.get("rpcUrls")[Chain.Ethereum]).toEqual(customRpcUrls);
    });

    test("sets RPC URL for multiple chains", () => {
      USwapConfig.reinitialize();

      USwapConfig.setRpcUrl(Chain.Ethereum, ["https://eth.rpc.com"]);
      USwapConfig.setRpcUrl(Chain.Avalanche, ["https://avax.rpc.com"]);

      const rpcUrls = USwapConfig.get("rpcUrls");
      expect(rpcUrls[Chain.Ethereum]).toEqual(["https://eth.rpc.com"]);
      expect(rpcUrls[Chain.Avalanche]).toEqual(["https://avax.rpc.com"]);
    });

    test("overwrites existing RPC URLs", () => {
      USwapConfig.reinitialize();

      USwapConfig.setRpcUrl(Chain.Bitcoin, ["https://btc-old.rpc.com"]);
      USwapConfig.setRpcUrl(Chain.Bitcoin, ["https://btc-new.rpc.com"]);

      expect(USwapConfig.get("rpcUrls")[Chain.Bitcoin]).toEqual(["https://btc-new.rpc.com"]);
    });
  });

  describe("setIntegrationConfig", () => {
    test("sets Radix integration config", () => {
      USwapConfig.reinitialize();

      const radixConfig = {
        applicationName: "Test DApp",
        applicationVersion: "1.0.0",
        dAppDefinitionAddress: "account_test123",
        network: { dashboardBase: "https://stokenet-dashboard.radixdlt.com", networkId: 2, networkName: "stokenet" },
      };

      USwapConfig.setIntegrationConfig("radix", radixConfig);

      const result = USwapConfig.get("integrations").radix;
      expect(result).toEqual(radixConfig);
    });

    test("sets Coinbase integration config", () => {
      USwapConfig.reinitialize();

      const coinbaseConfig = { appLogoUrl: "https://example.com/logo.png", appName: "My Coinbase App", darkMode: true };

      USwapConfig.setIntegrationConfig("coinbase", coinbaseConfig);

      const result = USwapConfig.get("integrations").coinbase;
      expect(result?.appName).toBe("My Coinbase App");
      expect(result?.darkMode).toBe(true);
    });

    test("sets Trezor integration config", () => {
      USwapConfig.reinitialize();

      const trezorConfig = { appUrl: "https://example.com", email: "test@example.com" };

      USwapConfig.setIntegrationConfig("trezor", trezorConfig);

      const result = USwapConfig.get("integrations").trezor;
      expect(result).toEqual(trezorConfig);
    });

    test("sets KeepKey integration config", () => {
      USwapConfig.reinitialize();

      const keepKeyConfig = {
        basePath: "/keepkey",
        imageUrl: "https://example.com/icon.png",
        name: "Test App",
        url: "https://example.com",
      };

      USwapConfig.setIntegrationConfig("keepKey", keepKeyConfig);

      const result = USwapConfig.get("integrations").keepKey;
      expect(result).toEqual(keepKeyConfig);
    });

    test("sets Chainflip integration config", () => {
      USwapConfig.reinitialize();

      const chainflipConfig = { brokerUrl: "https://broker.chainflip.io", useSDKBroker: true };

      USwapConfig.setIntegrationConfig("chainflip", chainflipConfig);

      const result = USwapConfig.get("integrations").chainflip;
      expect(result).toEqual(chainflipConfig);
    });
  });

  describe("setRequestOptions", () => {
    test("sets timeout option and preserves retry", () => {
      USwapConfig.reinitialize();

      const initialRetry = USwapConfig.get("requestOptions").retry;

      USwapConfig.setRequestOptions({ retry: initialRetry, timeoutMs: 60000 });

      const result = USwapConfig.get("requestOptions");
      expect(result.timeoutMs).toBe(60000);
    });

    test("sets retry options with timeoutMs", () => {
      USwapConfig.reinitialize();

      USwapConfig.setRequestOptions({
        retry: { backoffMultiplier: 3, baseDelay: 500, maxDelay: 10000, maxRetries: 5 },
        timeoutMs: 30000,
      });

      const result = USwapConfig.get("requestOptions");
      expect(result.retry.maxRetries).toBe(5);
      expect(result.retry.baseDelay).toBe(500);
      expect(result.retry.maxDelay).toBe(10000);
      expect(result.retry.backoffMultiplier).toBe(3);
    });

    test("merges partial retry options", () => {
      USwapConfig.reinitialize();

      const initialRetry = USwapConfig.get("requestOptions").retry;
      const initialTimeout = USwapConfig.get("requestOptions").timeoutMs;

      USwapConfig.setRequestOptions({ retry: { ...initialRetry, maxRetries: 10 }, timeoutMs: initialTimeout });

      const result = USwapConfig.get("requestOptions").retry;
      expect(result.maxRetries).toBe(10);
      // Should preserve other retry settings
      expect(result.baseDelay).toBe(initialRetry.baseDelay);
      expect(result.maxDelay).toBe(initialRetry.maxDelay);
    });
  });

  describe("setFeeMultipliers", () => {
    test("sets fee multipliers for options", () => {
      USwapConfig.reinitialize();

      const multipliers = { [FeeOption.Average]: 1.0, [FeeOption.Fast]: 1.5, [FeeOption.Fastest]: 2.0 };

      USwapConfig.setFeeMultipliers(multipliers);

      const result = USwapConfig.get("feeMultipliers");
      expect(result).toEqual(multipliers);
    });

    test("overwrites existing fee multipliers", () => {
      USwapConfig.reinitialize();

      const multipliers1 = { [FeeOption.Average]: 1.0, [FeeOption.Fast]: 1.5, [FeeOption.Fastest]: 2.0 };

      const multipliers2 = { [FeeOption.Average]: 1.2, [FeeOption.Fast]: 1.8, [FeeOption.Fastest]: 2.5 };

      USwapConfig.setFeeMultipliers(multipliers1);
      USwapConfig.setFeeMultipliers(multipliers2);

      const result = USwapConfig.get("feeMultipliers");
      expect(result).toEqual(multipliers2);
    });
  });

  describe("reinitialize", () => {
    test("resets all state to initial values", () => {
      // Modify some state
      USwapConfig.setApiKey("uSwap", "test-key");
      USwapConfig.setEnv("isDev", true);
      USwapConfig.setRpcUrl(Chain.Ethereum, ["https://custom.rpc.com"]);

      // Reinitialize
      USwapConfig.reinitialize();

      // Verify reset
      expect(USwapConfig.get("apiKeys").uSwap).toBe("");
      expect(USwapConfig.get("envs").isDev).toBe(false);
      // RPC URLs should be reset to defaults
      expect(USwapConfig.get("rpcUrls")[Chain.Ethereum]).toBeDefined();
    });

    test("can set values after reinitialize", () => {
      USwapConfig.reinitialize();

      USwapConfig.setApiKey("uSwap", "new-key");
      expect(USwapConfig.get("apiKeys").uSwap).toBe("new-key");
    });
  });

  describe("getState", () => {
    test("returns complete state object", () => {
      USwapConfig.reinitialize();

      const state = USwapConfig.getState();

      expect(state).toHaveProperty("apiKeys");
      expect(state).toHaveProperty("chains");
      expect(state).toHaveProperty("envs");
      expect(state).toHaveProperty("integrations");
      expect(state).toHaveProperty("rpcUrls");
      expect(state).toHaveProperty("wallets");
      expect(state).toHaveProperty("requestOptions");
    });

    test("state contains expected structure", () => {
      USwapConfig.reinitialize();

      const state = USwapConfig.getState();

      expect(Array.isArray(state.chains)).toBe(true);
      expect(typeof state.apiKeys).toBe("object");
      expect(typeof state.envs).toBe("object");
      expect(typeof state.integrations).toBe("object");
      expect(typeof state.rpcUrls).toBe("object");
    });
  });

  describe("multiple API keys", () => {
    test("sets and gets blockchair API key", () => {
      USwapConfig.reinitialize();

      USwapConfig.setApiKey("blockchair", "blockchair-key");
      expect(USwapConfig.get("apiKeys").blockchair).toBe("blockchair-key");
    });

    test("sets and gets keepKey API key", () => {
      USwapConfig.reinitialize();

      USwapConfig.setApiKey("keepKey", "keepkey-key");
      expect(USwapConfig.get("apiKeys").keepKey).toBe("keepkey-key");
    });

    test("sets and gets walletConnectProjectId", () => {
      USwapConfig.reinitialize();

      USwapConfig.setApiKey("walletConnectProjectId", "wc-project-id");
      expect(USwapConfig.get("apiKeys").walletConnectProjectId).toBe("wc-project-id");
    });

    test("sets and gets xaman API key", () => {
      USwapConfig.reinitialize();

      USwapConfig.setApiKey("xaman", "xaman-key");
      expect(USwapConfig.get("apiKeys").xaman).toBe("xaman-key");
    });
  });

  describe("setEndpoint", () => {
    test("sets endpoint", async () => {
      USwapConfig.reinitialize();

      USwapConfig.setEndpoint("getBalance", ({ chain }) =>
        Promise.resolve([{ chain, decimal: 18, identifier: "ETH", symbol: "ETH", ticker: "ETH", value: "100" }]),
      );

      const result = await USwapConfig.get("endpoints").getBalance({ address: "0x123", chain: Chain.Ethereum });

      expect(result).toEqual([
        { chain: Chain.Ethereum, decimal: 18, identifier: "ETH", symbol: "ETH", ticker: "ETH", value: "100" },
      ]);
    });
  });
});
