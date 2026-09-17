/**
 * Modifications © 2026 Horizontal Systems.
 */

import { AssetValue, Chain, ProviderName, type SwapParams, USwapError } from "@tcswap/helpers";
import type { QuoteResponseRoute } from "@tcswap/helpers/api";
import { createPlugin } from "../utils";

// Houdini Swap private route. The aggregator has already created the order on a non-dry quote:
// `inboundAddress` is its deposit address and `sellAmount` the exact amount it expects, so the
// swap is a plain transfer from the connected wallet. Nothing is approved or called on-chain —
// the two exchange hops happen on Houdini's side, tracked by `meta.houdini.houdiniId`.
export const HoudiniPlugin = createPlugin({
  methods: ({ getWallet }) => ({
    async swap({ route }: SwapParams<"houdini", QuoteResponseRoute>) {
      const { sellAsset, sellAmount, inboundAddress, memo, meta } = route;

      if (!inboundAddress) {
        throw new USwapError("core_swap_invalid_params", { missing: ["inboundAddress"] });
      }

      if (!meta?.houdini?.houdiniId) {
        throw new USwapError("core_swap_invalid_params", { missing: ["meta.houdini.houdiniId"] });
      }

      const assetValue = await AssetValue.from({ asset: sellAsset, asyncTokenLookup: true, value: sellAmount });
      const chain = assetValue.chain as Exclude<Chain, typeof Chain.Radix>;

      // A deposit to a centralized venue is identified by its destination tag on chains that
      // use one, and the toolboxes only carry a free-text memo on XRP. The aggregator refuses
      // such orders before they reach here; this is the last line.
      if (memo && chain === Chain.Ripple) {
        throw new USwapError("core_swap_invalid_params", { missing: ["destinationTag"] });
      }

      const wallet = getWallet(chain);

      if (!wallet) {
        throw new USwapError("core_wallet_connection_not_found");
      }

      const txHash = await wallet.transfer({
        assetValue,
        recipient: inboundAddress,
        sender: wallet.address,
        ...(memo ? { memo } : {}),
      });

      return txHash as string;
    },
  }),
  name: "houdini",
  properties: { supportedUSwapProviders: [ProviderName.HOUDINI] as const },
});
