import type { Chain } from "@tcswap/helpers";
import type { CoreTxParams } from "./types";

export function validateAddressType({ address }: { chain?: Chain; address?: string }) {
  return Boolean(address);
}

export function prepareTxParams({
  assetValue,
  from,
  memo = "",
  ...restTxParams
}: CoreTxParams & { from: string; router?: string }) {
  return { ...restTxParams, assetValue, from, memo };
}
