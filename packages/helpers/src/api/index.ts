/**
 * Modifications © 2025 Horizontal Systems.
 */

import { mayachainMidgard, thorchainMidgard } from "./midgard/endpoints";
import * as thornode from "./thornode/endpoints";
import * as uSwap from "./uSwapApi/endpoints";

export * from "./midgard/types";
export * from "./thornode/types";
export * from "./uSwapApi/types";

export const USwapApi = { ...uSwap, mayachainMidgard, thorchainMidgard, thornode };
