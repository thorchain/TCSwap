/**
 * Based on code from SwapKit (https://github.com/swapkit/SwapKit),
 * licensed under the Apache License 2.0.
 * Modifications © 2025 Horizontal Systems.
 */

import { AssetValue, Chain, ProviderName, type SwapParams, USwapError } from "@uswap/helpers";
import type { QuoteResponseRoute } from "@uswap/helpers/api";
import { createPlugin } from "../utils";

export const RadixPlugin = createPlugin({
  methods: ({ getWallet }) => ({
    swap: async function radixSwap({ route: { tx, sellAmount, sellAsset } }: SwapParams<"radix", QuoteResponseRoute>) {
      const assetValue = await AssetValue.from({ asset: sellAsset, asyncTokenLookup: true, value: sellAmount });

      if (Chain.Radix !== assetValue.chain) {
        throw new USwapError("core_swap_invalid_params");
      }

      const wallet = getWallet(assetValue.chain);
      try {
        return wallet.signAndBroadcast({ manifest: tx as string });
      } catch (error) {
        throw new USwapError("core_swap_invalid_params", error);
      }
    },
  }),
  name: "radix",
  properties: { supportedSwapkitProviders: [ProviderName.CAVIAR_V1] as const },
});
