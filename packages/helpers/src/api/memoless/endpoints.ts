/**
 * Modifications © 2025 Horizontal Systems.
 */

import { RequestClient, type RequestOptions, USwapConfig, USwapError } from "@tcswap/helpers";
import {
  type MemolessAssetsResponse,
  type PreflightRequest,
  type PreflightResult,
  PreflightResultSchema,
  type RegistrationRequest,
  type RegistrationResponse,
  RegistrationResponseSchema,
} from "./types";

const USwapRequestClient = RequestClient.extend({
  dynamicHeader: () => {
    const { memoless } = USwapConfig.get("apiKeys");
    return memoless ? { "x-api-key": memoless } : {};
  },
});

export function getMemolessAssets(options?: RequestOptions) {
  return USwapRequestClient.get<MemolessAssetsResponse>(getApiUrl("/assets"), { ...options });
}

export async function registerMemoless(json: RegistrationRequest, options?: RequestOptions) {
  const apiUrl = getApiUrl("/register");
  const response = await USwapRequestClient.post<RegistrationResponse>(apiUrl, { json, ...options });

  try {
    const parsedResponse = RegistrationResponseSchema.safeParse(response);
    if (!parsedResponse.success) {
      throw new USwapError("api_v2_invalid_response", parsedResponse.error);
    }

    return parsedResponse.data;
  } catch (_error) {
    return response;
  }
}

export async function preflightMemoless(json: PreflightRequest, options?: RequestOptions) {
  const apiUrl = getApiUrl("/preflight");
  const response = await USwapRequestClient.post<PreflightResult>(apiUrl, { json, ...options });

  try {
    const parsedResponse = PreflightResultSchema.safeParse(response);
    if (!parsedResponse.success) {
      throw new USwapError("api_v2_invalid_response", parsedResponse.error);
    }

    return parsedResponse.data;
  } catch (_error) {
    return response;
  }
}

function getApiUrl(path?: `/${string}`) {
  const { memolessApiUrl } = USwapConfig.get("envs");
  return `${memolessApiUrl}${path}`;
}
