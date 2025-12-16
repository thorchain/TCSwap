/**
 * Modifications © 2025 Horizontal Systems.
 */

import { USwapConfig } from "./uSwapConfig";
import { USwapError } from "./uSwapError";

export type RetryConfig = { maxRetries?: number; baseDelay?: number; maxDelay?: number; backoffMultiplier?: number };

export type RequestOptions = RequestInit & {
  /**
   * @deprecated @V4 Use onSuccess instead - will be removed in next major
   */
  responseHandler?: (response: any) => any;
  json?: unknown;
  onError?: (error: any) => any;
  onSuccess?: (response: any) => any;
  searchParams?: Record<string, string>;
  dynamicHeader?: () => Record<string, string> | {};
  retry?: RetryConfig;
  timeoutMs?: number;
  abortController?: AbortController;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const calculateDelay = (attempt: number, { baseDelay, backoffMultiplier, maxDelay }: any) =>
  Math.min(baseDelay * backoffMultiplier ** attempt, maxDelay);

const makeRequest = async (url: string, config: RequestInit) => {
  const response = await fetch(url, config);

  if (!response.ok) {
    const errorData = { status: response.status, statusText: response.statusText };
    throw new USwapError({ errorKey: "helpers_invalid_response", info: errorData }, errorData);
  }
  return response.json();
};

function fetchWithConfig(method: "GET" | "POST", extendOptions: RequestOptions = {}) {
  return async function methodFetchWithConfig<T>(url: string, options: RequestOptions = {}): Promise<T> {
    const {
      searchParams,
      json,
      body,
      headers,
      dynamicHeader,
      retry,
      timeoutMs,
      abortController,
      onError,
      onSuccess,
      responseHandler,
      ...fetchOptions
    } = { ...extendOptions, ...options };
    const requestOptions = USwapConfig.get("requestOptions");

    const retryConfig = { ...requestOptions.retry, ...retry };
    const isJson = !!json || url.endsWith(".json");
    const requestUrl = buildUrl(url, searchParams);
    const requestHeaders = buildHeaders(isJson, { ...headers, ...dynamicHeader?.() });
    const requestBody = isJson ? JSON.stringify(json) : body;

    let lastError: any;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      const controller = abortController || new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs || requestOptions.timeoutMs);

      try {
        const result = await makeRequest(requestUrl, {
          ...fetchOptions,
          body: requestBody,
          headers: requestHeaders,
          method,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        return onSuccess?.(result) || responseHandler?.(result) || result;
      } catch (error) {
        clearTimeout(timeoutId);
        lastError = error;

        if (attempt >= retryConfig.maxRetries) {
          return onError ? onError(error) : Promise.reject(error);
        }

        await sleep(calculateDelay(attempt, retryConfig));
      }
    }

    return onError ? onError(lastError) : Promise.reject(lastError);
  };
}

function buildHeaders(isJson: boolean, headers?: HeadersInit) {
  return { ...headers, ...(isJson && { "Content-Type": "application/json" }) };
}

function buildUrl(url: string, searchParams?: Record<string, string>) {
  const urlInstance = new URL(url);
  if (searchParams) urlInstance.search = new URLSearchParams(searchParams).toString();
  return urlInstance.toString();
}

export const RequestClient = {
  extend: (extendOptions: RequestOptions) => ({
    extend: (newOptions: RequestOptions) => RequestClient.extend({ ...extendOptions, ...newOptions }),
    get: fetchWithConfig("GET", extendOptions),
    post: fetchWithConfig("POST", extendOptions),
  }),
  get: fetchWithConfig("GET"),
  post: fetchWithConfig("POST"),
};
