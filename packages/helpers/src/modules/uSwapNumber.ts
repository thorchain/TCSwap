/**
 * Modifications © 2025 Horizontal Systems.
 */

import { BigIntArithmetics, formatBigIntToSafeValue } from "./bigIntArithmetics";

export type SwapKitValueType = BigIntArithmetics | string | number;

export class USwapNumber extends BigIntArithmetics {
  eq(value: SwapKitValueType) {
    return this.eqValue(value);
  }

  static fromBigInt(value: bigint, decimal?: number) {
    return new USwapNumber({ decimal, value: formatBigIntToSafeValue({ bigIntDecimal: decimal, decimal, value }) });
  }
}
