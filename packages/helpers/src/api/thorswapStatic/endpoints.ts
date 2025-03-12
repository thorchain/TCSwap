import {
  AssetValue,
  Chain,
  type ProviderName,
  RequestClient,
  getChainIdentifier,
} from "@swapkit/helpers";

import { getTokenListProviders } from "../swapkitApi/endpoints";
import type { TokenListProvidersResponse } from "../swapkitApi/types";
import type { TokensResponse } from "./types";

const baseUrl = "https://static.thorswap.net";

export function getStaticTokenList(tokenListName: string) {
  return RequestClient.get<TokensResponse>(`${baseUrl}/token-list/${tokenListName}.json`);
}

export function getLogoForAsset(assetString: string) {
  const mappedAssetIcon = getMappedAssetIcon(assetString);

  return `${baseUrl}/token-list/images/${mappedAssetIcon}.png`;
}

export function getChainLogoForAsset(assetString: string) {
  const { chain } = AssetValue.from({ asset: assetString });
  const chainIdentifier = getChainIdentifier(chain).toLowerCase();

  return `${baseUrl}/token-list/images/${chainIdentifier}.png`;
}

let providerData: TokenListProvidersResponse;

export async function getProviderLogo(providerName: ProviderName | string) {
  providerData ||= await getTokenListProviders();

  return providerData.find((p) => p.name === providerName)?.url;
}

function getMappedAssetIcon(assetString: string) {
  const { symbol } = AssetValue.from({ asset: assetString });

  if (symbol === Chain.Ethereum) return "eth.eth";

  return assetString.toLowerCase();
}
