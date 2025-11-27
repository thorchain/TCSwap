import type { AssetValue, DerivationPathArray, GenericTransferParams } from "@uswap/helpers";
import type { getTONToolbox } from "./toolbox";

export type TONSigner = { publicKey: any; secretKey: any };

export type TONToolboxParams = { provider?: string } & (
  | { signer?: TONSigner }
  | { phrase?: string; derivationPath?: DerivationPathArray; index?: number }
);

export type TONTransferParams = GenericTransferParams & { assetValue: AssetValue; recipient: string; memo?: string };

export type TONWallet = Awaited<ReturnType<typeof getTONToolbox>>;
