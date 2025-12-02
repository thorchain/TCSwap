/**
 * Based on code from SwapKit (https://github.com/swapkit/SwapKit),
 * licensed under the Apache License 2.0.
 * Modifications © 2025 Horizontal Systems.
 */

import { AssetValue, type Chain, ProviderName, USwapError } from "@uswap/helpers";
import { SwapKitApi } from "@uswap/helpers/api";
import { createPlugin } from "../utils";
import type { RequestSwapDepositAddressParams } from "./types";

export const ChainflipPlugin = createPlugin({
  methods: ({ getWallet }) => ({
    swap: async function chainflipSwap(swapParams: RequestSwapDepositAddressParams) {
      if (!(swapParams?.route?.buyAsset && swapParams.route.meta.chainflip)) {
        throw new USwapError("core_swap_invalid_params", { ...swapParams });
      }

      const {
        route: {
          buyAsset: buyAssetString,
          sellAsset: sellAssetString,
          sellAmount,
          meta: { chainflip },
        },
        maxBoostFeeBps = 0,
      } = swapParams;

      if (!(sellAssetString && buyAssetString)) {
        throw new USwapError("core_swap_asset_not_recognized");
      }

      const sellAsset = await AssetValue.from({ asset: sellAssetString, asyncTokenLookup: true, value: sellAmount });

      const wallet = getWallet(sellAsset.chain as Exclude<Chain, Chain.Radix>);

      if (!wallet || !("transfer" in wallet)) {
        throw new USwapError("core_wallet_connection_not_found");
      }

      const { depositAddress } = await SwapKitApi.getChainflipDepositChannel({
        ...chainflip,
        maxBoostFeeBps: maxBoostFeeBps || chainflip.maxBoostFeeBps,
      });

      const tx = await wallet.transfer({
        assetValue: sellAsset,
        isProgramDerivedAddress: true,
        recipient: depositAddress,
        sender: wallet.address,
      });

      return tx;
    },
  }),
  name: "chainflip",
  properties: { supportedSwapkitProviders: [ProviderName.CHAINFLIP, ProviderName.CHAINFLIP_STREAMING] as const },
});
