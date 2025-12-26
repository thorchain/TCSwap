/**
 * Modifications © 2025 Horizontal Systems.
 */

import { array, coerce, object, optional, z } from "zod/v4";

export const MemolessAssetItem = z.object({
  asset: z.string(),
  balanceRune: z.number(),
  decimals: coerce.number(),
  isToken: z.boolean(),
  priceUSD: z.number(),
  status: z.string(),
});

export const MemolessAssetsSchema = z.object({
  assets: array(MemolessAssetItem),
  error: optional(object({ code: z.string(), details: z.string(), message: z.string() })),
  success: z.boolean(),
});

export type MemolessAsset = z.infer<typeof MemolessAssetItem>;
export type MemolessAssetsResponse = z.infer<typeof MemolessAssetsSchema>;

export const RegistrationRequestSchema = z.object({
  asset: z.string(),
  memo: z.string(),
  requested_in_asset_amount: z.optional(z.string()).or(z.number()),
});

export type RegistrationRequest = z.infer<typeof RegistrationRequestSchema>;

export const RegistrationResponseSchema = z.object({
  asset: z.string(),
  decimals: z.number(),
  height: z.string(),
  internal_api_id: z.string(),
  memo: z.string(),
  minimum_amount_to_send: z.string(),
  reference: z.string(),
  reference_length: z.number(),
  registered_by: z.string(),
  registration_hash: z.string(),
  success: z.boolean(),
  suggested_in_asset_amount: z.optional(z.string()),
  txHash: z.string(),
});

export type RegistrationResponse = z.infer<typeof RegistrationResponseSchema>;

export enum PreflightInputType {
  asset = "asset",
  usd = "usd",
}

export const PreflightRequestSchema = z.object({
  amount: z.string(),
  asset: optional(z.string()),
  inputType: optional(z.enum(PreflightInputType)),
  internal_api_id: optional(z.string()),
  reference: optional(z.string()),
});

export type PreflightRequest = z.infer<typeof PreflightRequestSchema>;

export const PreflightResultSchema = z.object({
  data: z.object({
    blocks_remaining: z.number(),
    current_uses: z.number(),
    inbound_address: optional(z.string()),
    max_uses: z.number(),
    memo: optional(z.string()),
    qr_code: optional(z.string()),
    qr_code_data_url: optional(z.string()),
    seconds_remaining: z.number(),
    time_remaining: z.string(),
  }),
  error: optional(z.object({ code: z.string(), message: z.string() })),
  message: z.string(),
  success: z.boolean(),
});

export type PreflightResult = z.infer<typeof PreflightResultSchema>;
