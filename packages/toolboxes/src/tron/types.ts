import type {
  DerivationPathArray,
  GenericCreateTransactionParams,
  GenericTransferParams,
} from "@swapkit/helpers";
import type { Contract, Types } from "tronweb";

// Re-export TronWeb types for convenience
export type TronTransaction = Types.Transaction;
export type TronContract = Contract;
export type TronSignedTransaction = Types.SignedTransaction;

// Signer interface compatible with TronWeb and wallet implementations
export interface TronSigner {
  getAddress(): Promise<string>;
  signTransaction(transaction: TronTransaction): Promise<TronSignedTransaction>;
}

export type TronToolboxOptions =
  | { signer?: TronSigner }
  | { phrase?: string; derivationPath?: DerivationPathArray; index?: number }
  | {};

export interface TronTransferParams extends GenericTransferParams {
  // No additional fields needed - all inherited from GenericTransferParams
}

export interface TronCreateTransactionParams
  extends Omit<GenericCreateTransactionParams, "feeRate"> {
  // No additional fields needed - all inherited from GenericCreateTransactionParams
}
