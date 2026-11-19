/**
 * Flattens a committed route's `execution` block onto the legacy flat fields the swap
 * plugins consume (`route.tx` / `memo` / `inboundAddress` / `targetAddress` / …).
 */

import type { QuoteResponseRoute, SignableTx } from "./types";

/** Un-tags a `SignableTx` into the raw payload the legacy `route.tx` field carries. */
export function fromSignableTx(tx?: SignableTx) {
  if (!tx) return undefined;

  switch (tx.kind) {
    case "evm": {
      const { kind: _kind, ...evmTx } = tx;
      return evmTx;
    }
    case "psbt":
      return tx.psbt;
    case "solana":
      return tx.message;
    case "near":
      return tx.tx;
    case "stellar":
      return tx.xdr;
    default:
      return tx.tx;
  }
}

/** Routes without an `execution` block pass through unchanged. */
export function flattenSwapRoute(route: QuoteResponseRoute): QuoteResponseRoute {
  const { execution } = route;
  if (!execution) return route;

  const legacy = { ...route };

  switch (execution.method) {
    case "signed_transaction": {
      const tx = execution.transactions[0];
      legacy.tx = fromSignableTx(tx) as QuoteResponseRoute["tx"];
      if (tx?.kind === "evm") legacy.targetAddress = tx.to;
      break;
    }

    case "transfer": {
      legacy.inboundAddress = execution.depositAddress;
      legacy.targetAddress = execution.depositAddress;
      legacy.tx = fromSignableTx(execution.unsignedTx) as QuoteResponseRoute["tx"];
      if (execution.attachment) {
        legacy.txExtraAttribute =
          execution.attachment.type === "destination_tag"
            ? { destinationTag: execution.attachment.value }
            : { memo: execution.attachment.value };
      }
      if (execution.qr) {
        legacy.qrCodeStr = execution.qr.str;
        legacy.qrCodeDataURL = execution.qr.dataURL;
      }
      break;
    }

    case "thorchain_deposit": {
      legacy.memo = execution.memo;
      legacy.inboundAddress = execution.inboundAddress;
      legacy.expiration = execution.expiry;
      legacy.tx = fromSignableTx(execution.delivery.unsignedTx) as QuoteResponseRoute["tx"];
      if (execution.delivery.kind === "evm_contract_call") {
        legacy.targetAddress = execution.delivery.router;
      }
      if (execution.delivery.kind === "utxo_op_return" && execution.delivery.shieldedMemoAddress) {
        legacy.shielded_memo_address = execution.delivery.shieldedMemoAddress;
      }
      break;
    }
  }

  return legacy;
}
