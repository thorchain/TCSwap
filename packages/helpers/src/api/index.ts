/**
 * Modifications © 2025 Horizontal Systems.
 */

import * as memoless from "./memoless/endpoints";
import { mayachainMidgard, thorchainMidgard } from "./midgard/endpoints";
import * as thornode from "./thornode/endpoints";
import * as uswap from "./uswap/endpoints";

export * from "./memoless/types";
export * from "./midgard/types";
export * from "./thornode/types";
export * from "./uswap/types";

export const USwapApi = { ...uswap, ...memoless, mayachainMidgard, thorchainMidgard, thornode };
