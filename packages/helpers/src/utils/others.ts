/**
 * Based on code from SwapKit (https://github.com/swapkit/SwapKit),
 * licensed under the Apache License 2.0.
 * Modifications © 2025 Horizontal Systems.
 */

import { Chain } from "@uswap/types";
import { type ErrorKeys, USwapError } from "../modules/uSwapError";

// 10 rune for register, 1 rune per year
// MINIMUM_REGISTRATION_FEE = 11
export function getTHORNameCost(numberOfYears: number) {
  if (numberOfYears < 0) throw new USwapError({ errorKey: "helpers_invalid_number_of_years", info: { numberOfYears } });
  return 10 + numberOfYears;
}

// 10 CACAO for register
// 1.0512 CACAO per year
export function getMAYANameCost(numberOfYears: number) {
  if (numberOfYears < 0) throw new USwapError({ errorKey: "helpers_invalid_number_of_years", info: { numberOfYears } });
  // round to max 10 decimals
  return Math.round((10 + numberOfYears * 1.0512) * 1e10) / 1e10;
}

export function wrapWithThrow<T>(fn: () => T, errorKey?: ErrorKeys) {
  try {
    return fn();
  } catch (error) {
    if (errorKey) {
      throw new USwapError(errorKey, error);
    }

    return;
  }
}

export function getChainIdentifier<T extends Chain>(chain: T) {
  switch (chain) {
    case Chain.THORChain:
      return `${chain}.RUNE`;

    case Chain.Cosmos:
      return `${chain}.ATOM`;

    case Chain.BinanceSmartChain:
      return `${chain}`;

    default:
      return `${chain}.${chain}`;
  }
}

const warnings = new Set();
export function warnOnce({ condition, id, warning }: { condition: boolean; id: string; warning: string }) {
  if (condition) {
    if (warnings.has(id)) {
      return;
    }

    if (process.env.NODE_ENV !== "test") {
      console.warn(warning);
    }

    warnings.add(id);
  }
}
