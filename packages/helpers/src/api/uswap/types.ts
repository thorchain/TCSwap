/**
 * Modifications © 2025 Horizontal Systems.
 */

import { ErrorCode, FeeTypeEnum, ProviderName, WarningCodeEnum } from "@tcswap/helpers";
import { Chain, ChainId } from "@tcswap/types";
import { array, boolean, coerce, number, object, optional, string, union, unknown, type ZodType, z } from "zod/v4";

export enum PriorityLabel {
  CHEAPEST = "CHEAPEST",
  FASTEST = "FASTEST",
  RECOMMENDED = "RECOMMENDED",
}

export enum RouteQuoteTxType {
  PSBT = "PSBT",
  EVM = "EVM",
  COSMOS = "COSMOS",
  RADIX = "RADIX",
}

export enum TxnType {
  approve = "approve",
  claim = "claim",
  deposit = "deposit",
  donate = "donate",
  lending = "lending",
  lp_action = "lp_action",
  native_contract_call = "native_contract_call",
  native_send = "native_send",
  stake = "stake",
  streaming_swap = "streaming_swap",
  swap = "swap",
  thorname_action = "thorname_action",
  token_contract_call = "token_contract_call",
  token_transfer = "token_transfer",
  unknown = "unknown",
  unstake = "unstake",
}

export enum ProviderAction {
  swap = "swap",
  aggregation = "aggregation",
  addLiquidity = "addLiquidity",
  withdrawLiquidity = "withdrawLiquidity",
  addSavers = "addSavers",
  withdrawSavers = "withdrawSavers",
  borrow = "borrow",
  repay = "repay",
  name = "name",
  donate = "donate",
  claim = "claim",
  stake = "stake",
  unstake = "unstake",
}

export enum TxnStatus {
  unknown = "unknown",
  not_started = "not_started",
  pending = "pending",
  swapping = "swapping",
  completed = "completed",
  refunded = "refunded",
  failed = "failed",
}

export enum TrackingStatus {
  not_started = "not_started",
  starting = "starting",
  broadcasted = "broadcasted",
  mempool = "mempool",
  inbound = "inbound",
  outbound = "outbound",
  swapping = "swapping",
  completed = "completed",
  refunded = "refunded",
  partially_refunded = "partially_refunded",
  dropped = "dropped",
  reverted = "reverted",
  replaced = "replaced",
  retries_exceeded = "retries_exceeded",
  parsing_error = "parsing_error",
}

type TokenProviderVersion = { major: number; minor: number; patch: number };

export type TokenListProvidersResponse = Array<{
  provider: ProviderName;
  name: string;
  timestamp: string;
  version: TokenProviderVersion;
  keywords: string[];
  count: number;
  url: string;
}>;

export type TokensResponseV2 = {
  chainId: ChainId;
  count: number;
  keywords: string[];
  name: string;
  provider: ProviderName;
  timestamp: string;
  tokens: Token[];
  version: TokenProviderVersion;
};

export const TokenSchema = object({
  address: optional(string()),
  chain: z.enum(Chain).optional(),
  chainId: z.enum(ChainId),
  coingeckoId: optional(string()),
  decimals: coerce.number(),
  extensions: optional(z.looseObject({})),
  identifier: string(),
  logoURI: optional(string()),
  name: optional(string()),
  shortCode: optional(string()),
  symbol: optional(string()),
  ticker: string(),
});

export type Token = z.infer<typeof TokenSchema>;

export const TrackingRequestSchema = z
  .object({
    block: z.optional(z.number().describe("Block number. Required for Polkadot chain. e.g. `123456`")),
    chainId: z.optional(z.string().describe("ChainId for the hash. e.g. `thorchain-1`")),
    depositChannelId: z.optional(
      z.string().describe("Deposit channel ID, required for Chainflip if tx was broadcasted without wallet connection"),
    ),
    hash: z.optional(
      z
        .string()
        .describe(
          "Hash for the first transaction broadcasted by the end user. e.g. `88D1819378ECD09E5284C54937CDC1E99B52F253C007617A02DD1200710CE677`",
        ),
    ),
  })
  .refine((data) => (data.hash && data.chainId) || data.depositChannelId, {
    message: "Either `hash` and `chainId` or `depositChannelId` must be provided",
  });

export const TrackingRequestQuerySchema = z.object({
  forceUpdate: z
    .string()
    .toLowerCase()
    .transform((x) => x === "true")
    .pipe(z.boolean())
    .optional(),
});

export type TrackingRequest = z.infer<typeof TrackingRequestSchema>;

export const ApiV2ErrorSchema = object({ error: string(), message: string() });

export const AssetValueSchema = object({
  address: optional(string()),
  chain: z.enum(Chain),
  decimal: optional(number()),
  isGasAsset: boolean(),
  isSynthetic: boolean(),
  symbol: string(),
  tax: optional(object({ buy: number(), sell: number() })),
  ticker: string(),
});

export const TokenDetailsMetadataSchema = object({
  id: string(),
  market_cap: number(),
  name: string(),
  price_change_24h_usd: number(),
  price_change_percentage_24h_usd: number(),
  sparkline_in_7d: array(number()),
  timestamp: string(),
  total_volume: number(),
});

export const PriceResponseSchema = array(
  object({
    cg: TokenDetailsMetadataSchema.optional(),
    identifier: string(),
    price_usd: number(),
    provider: string(),
    timestamp: number(),
  }).partial(),
);

export type PriceResponse = z.infer<typeof PriceResponseSchema>;

export const QuoteRequestSchema = object({
  affiliate: optional(string().describe("Affiliate thorname")),
  affiliateFee: optional(
    number()
      .describe("Affiliate fee in basis points")
      .refine((fee) => fee === Math.floor(fee) && fee >= 0, {
        message: "affiliateFee must be a positive integer",
        path: ["affiliateFee"],
      }),
  ),
  allowSmartContractReceiver: optional(boolean().describe("Allow smart contract as recipient")),
  allowSmartContractSender: optional(boolean().describe("Allow smart contract as sender")),
  buyAsset: string().describe("Asset to buy"),
  cfBoost: optional(boolean().describe("Set to true to enable CF boost to speed up Chainflip swaps. BTC only.")),
  destinationAddress: optional(string().describe("Address to send asset to")),
  disableSecurityChecks: optional(boolean().describe("Disable security checks")),
  dry: optional(boolean().describe("Set to false to include an transaction object")),
  providers: optional(
    array(
      string()
        .describe("List of providers to use")
        .refine((provider) => ProviderName[provider as ProviderName] !== undefined, {
          message: "Invalid provider",
          path: ["providers"],
        }),
    ),
  ),
  referrer: optional(string().describe("Referrer address (referral program)")),
  refundAddress: optional(string().describe("Address to refund")),
  sellAmount: string()
    .describe("Amount of asset to sell")
    .refine((amount) => +amount > 0, { message: "sellAmount must be greater than 0", path: ["sellAmount"] }),
  sellAsset: string().describe("Asset to sell"),
  slippage: optional(number().describe("Slippage tolerance as a percentage. Default is 3%.")),
  sourceAddress: optional(string().describe("Address to send asset from")),
}).refine((data) => data.sellAsset !== data.buyAsset, {
  message: "Must be different",
  path: ["sellAsset", "buyAsset"],
});

export type QuoteRequest = z.infer<typeof QuoteRequestSchema>;

export const PriceRequestSchema = object({ metadata: boolean(), tokens: array(object({ identifier: string() })) });

export type PriceRequest = z.infer<typeof PriceRequestSchema>;

export const DepositChannelParamsSchema = object({ destinationAddress: string() });

export const BrokerDepositChannelParamsSchema = DepositChannelParamsSchema.extend({
  affiliateFees: array(object({ brokerAddress: string(), feeBps: number() })).optional(),
  brokerCommissionBps: number().optional(),
  buyAsset: object({ asset: string(), chain: string() }),
  channelMetadata: object({
    cfParameters: string().optional(),
    gasBudget: string().optional(),
    message: string().optional(),
  }).optional(),
  dcaParameters: object({ chunkInterval: number().optional(), numberOfChunks: number().optional() }).optional(),
  maxBoostFeeBps: number().optional(),
  refundParameters: object({
    minPrice: string().optional(),
    refundAddress: string().optional(),
    retryDuration: number().optional(),
  }).optional(),
  sellAsset: object({ asset: string(), chain: string() }),
});

export type BrokerDepositChannelParams = z.infer<typeof BrokerDepositChannelParamsSchema>;

export const DepositChannelResponseSchema = object({ channelId: string(), depositAddress: string() });

export const NearDepositChannelParamsSchema = DepositChannelParamsSchema.extend({
  affiliateFees: object({ feeBps: number(), nearId: string() }).optional(),
  buyAsset: string(),
  sellAmount: string(),
  sellAsset: string(),
  slippage: coerce.number(),
  sourceAddress: string(),
});

export type NearDepositChannelParams = z.infer<typeof NearDepositChannelParamsSchema>;

const NearQuoteResponseSchema = object({
  amountIn: string(),
  amountInFormatted: string(),
  amountInUsd: string(),
  amountOut: string(),
  amountOutFormatted: string(),
  amountOutUsd: string(),
  deadline: string().optional(),
  minAmountIn: string(),
  minAmountOut: string(),
  timeEstimate: number().optional(),
  timeWhenInactive: string().optional(),
});

export const NearDepositChannelResultSchema = NearQuoteResponseSchema.extend({
  depositAddress: string(),
  quote: NearQuoteResponseSchema,
  signature: string(),
  timestamp: string(),
  tx: unknown(),
});

export type NearDepositChannelResult = z.infer<typeof NearDepositChannelResultSchema>;

export const NearSwapResponseSchema = object({
  buyAsset: string(),
  buyAssetAmount: string(),
  buyAssetAmountMaxSlippage: string(),
  deadline: string().optional(),
  depositAddress: string(),
  depositAmount: string(),
  depositAsset: string(),
  tx: unknown(),
});

export type NearSwapResponse = z.infer<typeof NearSwapResponseSchema>;

export type DepositChannelResponse = z.infer<typeof DepositChannelResponseSchema>;

const TxnPayloadSchema = object({
  evmCalldata: z.optional(z.string()),
  intentHash: z.optional(z.string()),
  logs: z.optional(z.unknown()),
  manifest: z.optional(z.unknown()),
  memo: z.optional(z.string()),
  spender: z.optional(z.string()),
  thorname: z.optional(z.string()),
});

export type TxnPayload = z.infer<typeof TxnPayloadSchema>;

const TransactionEstimatesSchema = object({
  currentStage: string(),
  inboundConfirmation: number(),
  inboundObservation: number(),
  outboundDelay: number(),
  outboundObservation: number(),
  streamingSwap: number(),
});

export type TransactionEstimates = z.infer<typeof TransactionEstimatesSchema>;

const TransactionStreamingDetailsSchema = object({
  count: optional(number()),
  interval: optional(number()),
  quantity: optional(number()),
  subSwapsMap: optional(array(number())),
});

export type TransactionStreamingDetails = z.infer<typeof TransactionStreamingDetailsSchema>;

const TxnTransientSchema = z.object({
  currentLegIndex: z.optional(z.number()),
  estimatedTimeToComplete: z.number(),
  estimates: z.optional(TransactionEstimatesSchema),
  providerDetails: z.optional(z.object({ streamingDetails: z.optional(TransactionStreamingDetailsSchema) })),
});

export type TxnTransient = z.infer<typeof TxnTransientSchema>;

const TransactionFeesSchema = object({
  affiliate: optional(AssetValueSchema), // e.g. affiliate in memo, other affiliate mechanisms
  liquidity: optional(AssetValueSchema), // fee paid to pool
  network: optional(AssetValueSchema), // gas on ethereum, network fee on thorchain, etc.
  protocol: optional(AssetValueSchema), // extra protocol fees (TS dex aggregation contracts, stargate fees, etc.)
  tax: optional(AssetValueSchema), // taxed tokens
});

export type TransactionFees = z.infer<typeof TransactionFeesSchema>;

const TxnMetaAffiliateFeesSchema = object({ affiliate: string(), bps: string(), isReferrer: boolean() });

const TxnMetaSchema = object({
  affiliate: optional(string()),
  affiliateFees: optional(array(TxnMetaAffiliateFeesSchema)),
  broadcastedAt: optional(number()),
  explorerUrl: optional(string()),
  fees: optional(TransactionFeesSchema),
  images: optional(
    object({
      chain: optional(string()),
      from: optional(string()),
      provider: optional(string()),
      to: optional(string()),
    }),
  ),
  provider: optional(z.enum(ProviderName)),
  providerAction: z.optional(z.enum(ProviderAction)),
  wallet: optional(string()),
});

export type TxnMeta = z.infer<typeof TxnMetaSchema>;

const TransactionLegDTOSchema = z.object({
  block: z.number(),
  chainId: z.enum(ChainId),
  finalAddress: z.optional(z.string()),
  finalAsset: z.optional(AssetValueSchema),
  finalisedAt: z.number(),
  fromAddress: z.string(),
  fromAmount: z.string(),
  fromAsset: z.string(),
  hash: z.string(),
  meta: z.optional(TxnMetaSchema),
  payload: z.optional(TxnPayloadSchema),
  status: z.enum(TxnStatus),
  toAddress: z.string(),
  toAmount: z.string(),
  toAsset: z.string(),
  trackingStatus: z.optional(z.enum(TrackingStatus)),
  transient: z.optional(TxnTransientSchema),
  type: z.enum(TxnType),
});

export type TransactionLegDTO = z.infer<typeof TransactionLegDTOSchema>;

export const TrackerResponseSchema: z.ZodType<TransactionDTO> = TransactionLegDTOSchema.extend({
  legs: z.array(TransactionLegDTOSchema),
});

export type TrackerResponse = z.infer<typeof TrackerResponseSchema>;

export const TransactionSchema = TransactionLegDTOSchema.extend({ legs: array(TransactionLegDTOSchema) });

export type TransactionDTO = z.infer<typeof TransactionLegDTOSchema> & { legs: TransactionLegDTO[] };

export const TransactionDTOSchema: ZodType<TransactionDTO> = TransactionLegDTOSchema.extend({
  legs: array(TransactionLegDTOSchema),
});

export const FeesSchema = array(
  object({
    amount: string(),
    asset: string(),
    chain: string(),
    protocol: z.enum(ProviderName),
    type: z.enum(FeeTypeEnum),
  }),
);

export type Fees = z.infer<typeof FeesSchema>;

export const EstimatedTimeSchema = z.object({
  inbound: z.optional(z.number().describe("Time to receive inbound asset in seconds")),
  outbound: z.optional(z.number().describe("Time to receive outbound asset in seconds")),
  swap: z.optional(z.number().describe("Time to swap assets in seconds")),
  total: z.number().describe("Total time in seconds"),
});

export type EstimatedTime = z.infer<typeof EstimatedTimeSchema>;

export const EVMTransactionSchema = object({
  data: string().describe("Data to send"),
  from: string().describe("Address of the sender"),
  to: string().describe("Address of the recipient"),
  value: string().describe("Value to send"),
});

export type EVMTransaction = z.infer<typeof EVMTransactionSchema>;

export const EVMTransactionDetailsParamsSchema = array(
  union([
    string(),
    number(),
    array(string()),
    object({ from: string(), value: string() }).describe("Parameters to pass to the contract method"),
  ]),
);

export type EVMTransactionDetailsParams = z.infer<typeof EVMTransactionDetailsParamsSchema>;

export const EVMTransactionDetailsSchema = object({
  approvalSpender: optional(string().describe("Address of the spender to approve")),
  approvalToken: optional(string().describe("Address of the token to approve spending of")),
  contractAddress: string().describe("Address of the contract to interact with"),
  contractMethod: string().describe("Name of the method to call"),
  contractParamNames: array(string().describe("Names of the parameters to pass to the contract method")),
  contractParams: EVMTransactionDetailsParamsSchema,
});

export type EVMTransactionDetails = z.infer<typeof EVMTransactionDetailsSchema>;

const EncodeObjectSchema = object({ typeUrl: string(), value: unknown() });

const FeeSchema = object({ amount: array(object({ amount: string(), denom: string() })), gas: string() });

export const CosmosTransactionSchema = object({
  accountNumber: number(),
  chainId: z.enum(ChainId),
  fee: FeeSchema,
  memo: string(),
  msgs: array(EncodeObjectSchema),
  sequence: number(),
});

export type CosmosTransaction = z.infer<typeof CosmosTransactionSchema>;

export const RouteLegSchema = object({
  affiliate: string().describe("Affiliate address").optional(),
  affiliateFee: number().describe("Affiliate fee").optional(),
  buyAsset: string().describe("Asset to buy"),
  destinationAddress: string().describe("Destination address"),
  estimatedTime: EstimatedTimeSchema.optional(),
  provider: z.enum(ProviderName),
  sellAsset: string().describe("Asset to sell"),
  slipPercentage: number().describe("Slippage as a percentage"),
  sourceAddress: string().describe("Source address"),
});

export type RouteLeg = z.infer<typeof RouteLegSchema>;

export const RouteLegWithoutAddressesSchema = RouteLegSchema.omit({
  destinationAddress: true,
  slipPercentage: true,
  sourceAddress: true,
});

export type RouteLegWithoutAddresses = z.infer<typeof RouteLegWithoutAddressesSchema>;

export const RouteQuoteMetadataAssetSchema = object({
  asset: string().describe("Asset name"),
  image: string().describe("Asset image"),
  price: number().describe("Price in USD"),
});

export type RouteQuoteMetadataAsset = z.infer<typeof RouteQuoteMetadataAssetSchema>;

export const ChainflipMetadataSchema = BrokerDepositChannelParamsSchema;

export type ChainflipMetadata = z.infer<typeof ChainflipMetadataSchema>;

export const RouteQuoteMetadataSchema = object({
  assets: optional(array(RouteQuoteMetadataAssetSchema)),
  maxStreamingQuantity: number().optional(),
  referrer: string().optional(),
  streamingInterval: number().optional(),
  tags: array(z.enum(PriorityLabel)).optional(),
});

// Houdini Swap private route (`providers: ["HOUDINI"]`): two centralized-exchange hops with no
// on-chain link between deposit and payout. `houdiniId` only exists once the order does (a
// non-dry quote); it tracks the swap and links to the public order page.
export const HoudiniMetadataSchema = object({
  amountInUsd: optional(number()),
  amountOutUsd: optional(number()),
  depositTag: optional(string()),
  expires: optional(number()),
  houdiniId: optional(string()),
  markup: optional(number()),
  max: optional(number()),
  min: optional(number()),
  orderUrl: optional(string()),
  quoteId: string(),
  swapName: optional(string()),
  type: string(),
});

export type HoudiniMetadata = z.infer<typeof HoudiniMetadataSchema>;

export const RouteQuoteMetadataV2Schema = RouteQuoteMetadataSchema.extend({
  affiliate: optional(string()),
  affiliateFee: optional(string()),
  approvalAddress: optional(string().describe("Approval address for swap")),
  chainflip: ChainflipMetadataSchema.optional(),
  garden: NearDepositChannelParamsSchema.optional(),
  houdini: HoudiniMetadataSchema.optional(),
  near: NearDepositChannelParamsSchema.optional(),
  priceImpact: optional(number().describe("Price impact")),
  referrer: optional(string()),
  slippageBps: optional(number().describe("Slippage in basis points")),
  totalBps: optional(number().describe("Total fee in basis points")),
  txType: optional(z.enum(RouteQuoteTxType)),
});

export const RouteQuoteWarningSchema = array(
  object({ code: z.enum(WarningCodeEnum), display: string(), tooltip: string().optional() }),
);

export type RouteQuoteWarning = z.infer<typeof RouteQuoteWarningSchema>;

const QuoteResponseRouteLegItem = object({
  buyAmount: string().describe("Buy amount"),
  buyAmountMaxSlippage: string().describe("Buy amount max slippage"),
  buyAsset: string().describe("Asset to buy"),
  fees: optional(FeesSchema),
  provider: z.enum(ProviderName),
  sellAmount: string().describe("Sell amount"),
  sellAsset: string().describe("Asset to sell"),
});

// --- Aggregator /v3 (API_V3.md) -------------------------------------------------------------
// A v3 route says how to pay in one `execution` block. The swap plugins read the older flat
// fields (`tx`, `memo`, `inboundAddress`, `targetAddress`, `expiration`), which `flattenSwapRoute`
// (./serializer) fills from it.

export const SignableTxSchema = z.discriminatedUnion("kind", [
  object({
    data: string(),
    from: string(),
    gas: optional(string()),
    gasPrice: optional(string()),
    kind: z.literal("evm"),
    to: string(),
    value: string(),
  }),
  object({ kind: z.literal("psbt"), psbt: string() }),
  object({ kind: z.literal("solana"), message: string() }),
  object({ kind: z.literal("near"), tx: string() }),
  object({ kind: z.literal("stellar"), xdr: string() }),
  object({ kind: z.literal("cosmos"), tx: unknown() }),
  object({ kind: z.literal("ripple"), tx: unknown() }),
  object({ kind: z.literal("ton"), tx: unknown() }),
  object({ kind: z.literal("tron"), tx: unknown() }),
]);

export type SignableTx = z.infer<typeof SignableTxSchema>;

export const ExecutionApprovalSchema = object({
  amount: string().describe("Allowance amount in base units"),
  spender: string().describe("Spender to approve"),
  token: string().describe("Token that needs an allowance"),
});

export type ExecutionApproval = z.infer<typeof ExecutionApprovalSchema>;

/**
 * Order identifier bound to a `transfer` deposit — `destination_tag` goes in the tx's
 * tag field (e.g. XRP), `text` in the memo field. Omitting it strands the funds.
 */
export const TransferAttachmentSchema = z.discriminatedUnion("type", [
  object({ type: z.literal("destination_tag"), value: string() }),
  object({ type: z.literal("text"), value: string() }),
]);

export type TransferAttachment = z.infer<typeof TransferAttachmentSchema>;

export const ThorchainDeliverySchema = z.discriminatedUnion("kind", [
  object({
    approval: optional(ExecutionApprovalSchema),
    kind: z.literal("evm_contract_call"),
    router: string().describe("Router contract encoding the memo — a plain transfer will not work"),
    unsignedTx: optional(SignableTxSchema),
  }),
  object({
    kind: z.literal("utxo_op_return"),
    shieldedMemoAddress: optional(string().describe("Maya ZEC only: send the memo to this 2nd shielded output")),
    unsignedTx: optional(SignableTxSchema),
  }),
  object({ kind: z.literal("cosmos_memo"), unsignedTx: optional(SignableTxSchema) }),
]);

export type ThorchainDelivery = z.infer<typeof ThorchainDeliverySchema>;

/** How to send funds for a committed route — switch on `method` and handle only that branch. */
export const SwapExecutionSchema = z.discriminatedUnion("method", [
  object({
    approval: optional(ExecutionApprovalSchema),
    chain: string().describe("Source chain — decides the tx shape"),
    method: z.literal("signed_transaction"),
    transactions: array(SignableTxSchema),
  }),
  object({
    amount: string(),
    asset: string(),
    attachment: optional(TransferAttachmentSchema),
    chain: string(),
    depositAddress: string(),
    method: z.literal("transfer"),
    qr: optional(object({ dataURL: string(), str: string() })),
    unsignedTx: optional(SignableTxSchema),
    unsignedTxUnavailable: optional(boolean()),
  }),
  object({
    amount: string(),
    asset: string(),
    chain: string(),
    delivery: ThorchainDeliverySchema,
    expiry: optional(string()),
    inboundAddress: string(),
    memo: string().describe("The memo IS the swap order — never omit it"),
    method: z.literal("thorchain_deposit"),
    protocol: z.enum(["THORCHAIN", "MAYACHAIN"]),
  }),
]);

export type SwapExecution = z.infer<typeof SwapExecutionSchema>;

/** What `POST /v3/rate` and `POST /v3/preview` share. Exactly one of `sellAmount` / `buyAmount` is given. */
const v3QuoteFields = {
  buyAmount: optional(string().describe("Exact output: the amount to receive")),
  buyAsset: string().describe("Asset to buy"),
  chainId: optional(string().describe("Required when an asset is a bare contract address")),
  floating: optional(boolean()),
  sellAmount: optional(string().describe("Exact input: the amount to spend")),
  sellAsset: string().describe("Asset to sell"),
  slippage: number().describe("Tolerance in percent, at least 0 and below 100"),
  streamingInterval: optional(number().describe("THORChain / Mayachain only")),
  streamingQuantity: optional(number().describe("THORChain / Mayachain only")),
};

/** `POST /v3/rate` - compare routes. Read-only, no addresses. */
export const RateRequestSchema = object({
  ...v3QuoteFields,
  privacy: optional(array(z.enum(["none", "basic"])).describe("The rails wanted; the server picks the providers")),
  providers: optional(array(string()).describe("Narrow the comparison to these providers")),
});
export type RateRequest = z.infer<typeof RateRequestSchema>;

/** The client's fee settings for the inbound transaction, so the preview is priced as it will be signed. */
export const NetworkFeeSchema = z.discriminatedUnion("kind", [
  object({ gasPrice: string(), kind: z.literal("legacy") }),
  object({ kind: z.literal("eip1559"), maxFeePerGas: string(), maxPriorityFeePerGas: string() }),
  object({ feeRate: number(), kind: z.literal("utxo") }),
  object({ computeUnitPrice: number(), kind: z.literal("solana") }),
]);
export type NetworkFee = z.infer<typeof NetworkFeeSchema>;

/** `POST /v3/preview` - one provider, with addresses: the deposit details and a `previewToken`. Creates nothing. */
export const PreviewRequestSchema = object({
  ...v3QuoteFields,
  destinationAddress: string().describe("Where the bought funds are sent"),
  destinationMemo: optional(string().describe("The tag or memo the payout must carry (HOUDINI_PRIVATE only)")),
  generateQR: optional(boolean().describe("transfer providers: return a deposit QR code from commit")),
  networkFee: optional(NetworkFeeSchema),
  provider: string().describe("The single provider to create the order with"),
  refundAddress: optional(string()),
  sourceAddress: optional(string().describe("The sending account; required for signed_transaction providers")),
});
export type PreviewRequest = z.infer<typeof PreviewRequestSchema>;

/** `POST /v3/commit` - creates the order for a previewed route and returns its `uuid`. */
export const CommitRequestSchema = object({
  inboundTxHash: optional(string().describe("The signed inbound transaction's hash, reported before broadcasting")),
  previewToken: string(),
});
export type CommitRequest = z.infer<typeof CommitRequestSchema>;

/**
 * Which Zcash addresses one side of a route takes: a unified (u1…) address when `unified` is
 * present, a transparent one when `transparent`, a TEX (ZIP-320) one when `tex`.
 */
export const ZcashAddressRuleSchema = object({
  sameAsRefund: optional(boolean().describe("source only: sourceAddress, when sent, must equal refundAddress")),
  tex: optional(boolean()),
  transparent: optional(boolean()),
  unified: optional(object({ receivers: array(string()), requiresOneOf: array(string()) })),
});
export type ZcashAddressRule = z.infer<typeof ZcashAddressRuleSchema>;

export const ZcashAddressRulesSchema = object({
  destination: optional(ZcashAddressRuleSchema),
  refund: optional(ZcashAddressRuleSchema),
  source: optional(ZcashAddressRuleSchema),
});
export type ZcashAddressRules = z.infer<typeof ZcashAddressRulesSchema>;

/** The one way a provider is paid, as `GET /v3/providers` names it and `execution.method` repeats it. */
export type SwapExecutionMethod = SwapExecution["method"];

export const QuoteResponseRouteItem = object({
  addressRules: optional(ZcashAddressRulesSchema).describe("v3: on a route with ZEC on either side"),
  approvalSpender: optional(string().describe("v3: the spender a token sell must be approved to")),
  buyAsset: string().describe("Asset to buy"),
  destinationAddress: optional(string().describe("Destination address")),
  estimatedTime: optional(EstimatedTimeSchema),
  execution: optional(SwapExecutionSchema).describe("v3: how to send the funds"),
  executionType: optional(z.enum(["signed_transaction", "transfer", "thorchain_deposit"])).describe(
    "v3: the provider's execution method, known before a preview exists",
  ),
  expectedBuyAmount: string().describe("Expected Buy amount"),
  expectedBuyAmountMaxSlippage: optional(string().describe("Expected Buy amount max slippage")),
  expiration: optional(string().describe("Expiration")),
  expiresAt: optional(number().describe("v3: when the quote lapses, epoch ms")),
  fees: FeesSchema,
  inboundAddress: optional(string().describe("Inbound address")),
  legs: optional(array(QuoteResponseRouteLegItem)),
  memo: optional(string().describe("Memo")),
  meta: optional(RouteQuoteMetadataV2Schema),
  minBuyAmount: optional(
    string().nullable().describe("v3: the enforced floor; null when nothing enforces the quoted amount"),
  ),
  previewToken: optional(string().describe("v3: set by /preview; commit it to create the order")),
  providers: array(z.enum(ProviderName)),
  // Deposit QR code (data URL) for a wallet-less deposit-address swap, when the quote was
  // requested without a source address.
  qrCodeDataURL: optional(string().describe("Deposit QR code data URL")),
  qrCodeStr: optional(string()),
  refundAddress: optional(string().describe("Refund address")),
  sellAmount: string().describe("Sell amount"),
  sellAsset: string().describe("Asset to sell"),
  shielded_memo_address: optional(string()),
  sourceAddress: optional(string().describe("Source address")),
  targetAddress: optional(string().describe("Target address")),
  tx: optional(union([EVMTransactionSchema, CosmosTransactionSchema, string()])),
  txExtraAttribute: optional(z.looseObject({})),
  txType: optional(z.enum(RouteQuoteTxType)),
  uuid: optional(string().describe("v3: set by /commit - the handle /track takes")),
  warnings: optional(RouteQuoteWarningSchema),
});

export const QuoteResponseSchema = object({
  error: optional(string().describe("Error message")),
  providerErrors: optional(
    array(
      object({
        errorCode: optional(z.enum(ErrorCode)),
        message: optional(string()),
        provider: z.enum(ProviderName).optional(),
      }),
    ),
  ),
  routes: array(QuoteResponseRouteItem),
});

export type QuoteResponse = z.infer<typeof QuoteResponseSchema>;
export type QuoteResponseRoute = z.infer<typeof QuoteResponseRouteItem>;
export type QuoteResponseRouteLeg = z.infer<typeof QuoteResponseRouteLegItem>;

export const GasSchema = z.object({
  chainId: z.enum(ChainId),
  createdAt: z.date(),
  id: z.number(),
  unit: z.string(),
  value: z.string(),
});

const GasSchemaArray = z.array(GasSchema);

export const GasResponseSchema = z.union([GasSchema, GasSchemaArray]);

export type GasResponse = z.infer<typeof GasResponseSchema>;

const BalanceResponseSchema = array(
  object({
    chain: z.enum(Chain),
    decimal: number(),
    identifier: string(),
    symbol: string(),
    ticker: string(),
    value: string(),
  }),
);

export type BalanceResponse = z.infer<typeof BalanceResponseSchema>;
