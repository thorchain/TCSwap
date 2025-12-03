/**
 * Modifications © 2025 Horizontal Systems.
 */

import { AssetValue, Chain, ProviderName, type SwapParams, USwapError } from "@uswap/helpers";
import type { QuoteResponseRoute } from "@uswap/helpers/api";
import { createPlugin } from "../utils";

export const SolanaPlugin = createPlugin({
  methods: ({ getWallet }) => ({
    swap: async function solanaSwap({ route }: SwapParams<"solana", QuoteResponseRoute>) {
      const { VersionedTransaction } = await import("@solana/web3.js");
      const { tx, sellAsset } = route;

      const assetValue = await AssetValue.from({ asset: sellAsset });

      const chain = assetValue.chain;
      if (!(chain === Chain.Solana && tx)) throw new USwapError("core_swap_invalid_params");

      const wallet = getWallet(chain);
      const transaction = VersionedTransaction.deserialize(Buffer.from(tx as string, "base64"));

      const signedTransaction = await wallet.signTransaction(transaction);

      return wallet.broadcastTransaction(signedTransaction);
    },
  }),
  name: "solana",
  properties: { supportedUSwapProviders: [ProviderName.JUPITER] as const },
});
