/**
 * Modifications © 2025 Horizontal Systems.
 */

import type { Chain } from "@tcswap/types";
import { USwapConfig } from "../modules/uSwapConfig";
import { USwapError } from "../modules/uSwapError";
import { isSecuredAssetIdentifier } from "./asset";

// Backward compatibility
const supportedChains = ["TERRA", ...USwapConfig.get("chains")];

export function validateIdentifier(identifier = "") {
  const uppercasedIdentifier = identifier.toUpperCase();

  const [chain] = uppercasedIdentifier.split(".") as [Chain, string];
  if (supportedChains.includes(chain)) return true;

  const [synthChain] = uppercasedIdentifier.split("/") as [Chain, string];
  if (supportedChains.includes(synthChain)) return true;

  if (isSecuredAssetIdentifier(identifier)) return true;

  throw new USwapError({
    errorKey: "helpers_invalid_identifier",
    info: {
      identifier,
      message: `Invalid identifier: ${identifier}. Expected format: <Chain>.<Ticker> or <Chain>.<Ticker>-<ContractAddress>`,
    },
  });
}

export function validateTNS(name: string) {
  if (name.length > 30) return false;

  const regex = /^[a-zA-Z0-9+_-]+$/g;

  return !!name.match(regex);
}
