/**
 * Modifications © 2025 Horizontal Systems.
 */

import { Chain, getChainConfig } from "@tcswap/types";
import { USwapNumber } from "../modules/uSwapNumber";

type ShareParams<T extends {}> = T & { liquidityUnits: string; poolUnits: string };

type PoolParams = { runeAmount: string; assetAmount: string; runeDepth: string; assetDepth: string };

/**
 *  Ref: https://gitlab.com/thorchain/thornode/-/issues/657
 *  share = (s * A * (2 * T^2 - 2 * T * s + s^2))/T^3
 *  s = stakeUnits for member (after factoring in withdrawBasisPoints)
 *  T = totalPoolUnits for pool
 *  A = assetDepth to be withdrawn
 *
 *  Formula:
 *  share = (s * A * (2 * T^2 - 2 * T * s + s^2))/T^3
 *  (part1 * (part2 - part3 + part4)) / part5
 */
export function getAsymmetricRuneShare({ liquidityUnits, poolUnits, runeDepth }: ShareParams<{ runeDepth: string }>) {
  const s = toTCUSwapNumber(liquidityUnits);
  const T = toTCUSwapNumber(poolUnits);
  const A = toTCUSwapNumber(runeDepth);

  const part1 = s.mul(A);
  const part2 = T.mul(T).mul(2);
  const part3 = T.mul(s).mul(2);
  const part4 = s.mul(s);
  const part5 = T.mul(T).mul(T);

  const numerator = part1.mul(part2.sub(part3).add(part4));

  return numerator.div(part5);
}

export function getAsymmetricAssetShare({
  liquidityUnits,
  poolUnits,
  assetDepth,
}: ShareParams<{ assetDepth: string }>) {
  const s = toTCUSwapNumber(liquidityUnits);
  const T = toTCUSwapNumber(poolUnits);
  const A = toTCUSwapNumber(assetDepth);

  const part1 = s.mul(A);
  const part2 = T.mul(T).mul(2);
  const part3 = T.mul(s).mul(2);
  const part4 = s.mul(s);
  const numerator = part1.mul(part2.sub(part3).add(part4));
  const part5 = T.mul(T).mul(T);

  return numerator.div(part5);
}

export function getAsymmetricRuneWithdrawAmount({
  percent,
  runeDepth,
  liquidityUnits,
  poolUnits,
}: ShareParams<{ percent: number; runeDepth: string }>) {
  return getAsymmetricRuneShare({ liquidityUnits, poolUnits, runeDepth }).mul(percent);
}

export function getAsymmetricAssetWithdrawAmount({
  percent,
  assetDepth,
  liquidityUnits,
  poolUnits,
}: ShareParams<{ percent: number; assetDepth: string }>) {
  return getAsymmetricAssetShare({ assetDepth, liquidityUnits, poolUnits }).mul(percent);
}

function toTCUSwapNumber(value: string) {
  return USwapNumber.fromBigInt(BigInt(value), getChainConfig(Chain.THORChain).baseDecimal);
}

export function getSymmetricPoolShare({
  liquidityUnits,
  poolUnits,
  runeDepth,
  assetDepth,
}: ShareParams<{ runeDepth: string; assetDepth: string }>) {
  return {
    assetAmount: toTCUSwapNumber(assetDepth).mul(liquidityUnits).div(poolUnits),
    runeAmount: toTCUSwapNumber(runeDepth).mul(liquidityUnits).div(poolUnits),
  };
}

export function getSymmetricWithdraw({
  liquidityUnits,
  poolUnits,
  runeDepth,
  assetDepth,
  percent,
}: ShareParams<{ runeDepth: string; assetDepth: string; percent: number }>) {
  return Object.fromEntries(
    Object.entries(getSymmetricPoolShare({ assetDepth, liquidityUnits, poolUnits, runeDepth })).map(([name, value]) => [
      name,
      value.mul(percent),
    ]),
  );
}

export function getEstimatedPoolShare({
  runeDepth,
  poolUnits,
  assetDepth,
  liquidityUnits,
  runeAmount,
  assetAmount,
}: ShareParams<{ runeAmount: string; assetAmount: string; runeDepth: string; assetDepth: string }>) {
  const R = new USwapNumber({ decimal: 8, value: runeDepth });
  const A = new USwapNumber({ decimal: 8, value: assetDepth });
  const P = new USwapNumber({ decimal: 8, value: poolUnits });
  const runeAddAmount = new USwapNumber({ decimal: 8, value: runeAmount });
  const assetAddAmount = new USwapNumber({ decimal: 8, value: assetAmount });

  // liquidityUnits = P * (r*A + a*R + 2*r*a) / (r*A + a*R + 2*R*A)
  const rA = runeAddAmount.mul(A);
  const aR = assetAddAmount.mul(R);
  const ra = runeAddAmount.mul(assetAddAmount);
  const RA = R.mul(A);
  const numerator = P.mul(rA.add(aR.add(ra.mul(2))));
  const denominator = rA.add(aR.add(RA.mul(2)));
  const liquidityUnitsAfterAdd = numerator.div(denominator);
  const estimatedLiquidityUnits = toTCUSwapNumber(liquidityUnits).add(liquidityUnitsAfterAdd);

  if (liquidityUnitsAfterAdd.getBaseValue("number") === 0) {
    return estimatedLiquidityUnits.div(P).getBaseValue("number");
  }

  // get pool units after add
  const newPoolUnits = P.add(estimatedLiquidityUnits);

  return estimatedLiquidityUnits.div(newPoolUnits).getBaseValue("number");
}

export function getLiquiditySlippage({ runeAmount, assetAmount, runeDepth, assetDepth }: PoolParams) {
  if (runeAmount === "0" || assetAmount === "0" || runeDepth === "0" || assetDepth === "0") return 0;
  // formula: (t * R - T * r)/ (T*r + R*T)
  const R = toTCUSwapNumber(runeDepth);
  const T = toTCUSwapNumber(assetDepth);
  const assetAddAmount = toTCUSwapNumber(assetAmount);
  const runeAddAmount = toTCUSwapNumber(runeAmount);

  const numerator = assetAddAmount.mul(R).sub(T.mul(runeAddAmount));
  const denominator = T.mul(runeAddAmount).add(R.mul(T));

  // set absolute value of percent, no negative allowed
  return Math.abs(numerator.div(denominator).getBaseValue("number"));
}
