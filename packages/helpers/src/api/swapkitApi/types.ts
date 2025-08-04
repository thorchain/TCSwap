import {
  Chain,
  ChainId,
  ErrorCode,
  FeeTypeEnum,
  ProviderName,
  WarningCodeEnum,
} from "@swapkit/helpers";
import {
  type ZodType,
  array,
  boolean,
  coerce,
  number,
  object,
  optional,
  string,
  union,
  unknown,
  z,
} from "zod/v4";

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
  native_send = "native_send",
  token_transfer = "token_transfer",
  native_contract_call = "native_contract_call",
  token_contract_call = "token_contract_call",
  approve = "approve",
  deposit = "deposit",
  thorname_action = "thorname_action",
  lp_action = "lp_action",
  swap = "swap",
  streaming_swap = "streaming_swap",
  stake = "stake",
  claim = "claim",
  lending = "lending",
  unknown = "unknown",
}

export enum TxnStatus {
  unknown = "unknown",
  not_started = "not_started",
  pending = "pending",
  swapping = "swapping",
  completed = "completed",
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

type TokenProviderVersion = {
  major: number;
  minor: number;
  patch: number;
};

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
  chain: z.enum(Chain).optional(),
  address: optional(string()),
  chainId: z.enum(ChainId),
  ticker: string(),
  identifier: string(),
  symbol: optional(string()),
  name: optional(string()),
  decimals: coerce.number(),
  logoURI: optional(string()),
  extensions: optional(z.looseObject({})),
  shortCode: optional(string()),
  coingeckoId: optional(string()),
});

export type Token = z.infer<typeof TokenSchema>;

export const TrackingRequestSchema = z
  .object({
    hash: z.optional(
      z
        .string()
        .describe(
          "Hash for the first transaction broadcasted by the end user. e.g. `88D1819378ECD09E5284C54937CDC1E99B52F253C007617A02DD1200710CE677`",
        ),
    ),
    chainId: z.optional(z.string().describe("ChainId for the hash. e.g. `thorchain-1`")),
    block: z.optional(
      z.number().describe("Block number. Required for Polkadot chain. e.g. `123456`"),
    ),
    depositChannelId: z.optional(
      z
        .string()
        .describe(
          "Deposit channel ID, required for Chainflip if tx was broadcasted without wallet connection",
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

export const ApiV2ErrorSchema = object({
  error: string(),
  message: string(),
});

export const AssetValueSchema = object({
  chain: z.enum(Chain),
  symbol: string(),
  ticker: string(),
  decimal: optional(number()),
  address: optional(string()),
  isGasAsset: boolean(),
  isSynthetic: boolean(),
  tax: optional(object({ buy: number(), sell: number() })),
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
    identifier: string(),
    provider: string(),
    cg: TokenDetailsMetadataSchema.optional(),
    price_usd: number(),
    timestamp: number(),
  }).partial(),
);

export type PriceResponse = z.infer<typeof PriceResponseSchema>;

export const QuoteRequestSchema = object({
  sellAsset: string().describe("Asset to sell"),
  buyAsset: string().describe("Asset to buy"),
  sellAmount: string()
    .describe("Amount of asset to sell")
    .refine((amount) => +amount > 0, {
      message: "sellAmount must be greater than 0",
      path: ["sellAmount"],
    }),
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
  sourceAddress: optional(string().describe("Address to send asset from")),
  destinationAddress: optional(string().describe("Address to send asset to")),
  slippage: optional(number().describe("Slippage tolerance as a percentage. Default is 3%.")),
  affiliate: optional(string().describe("Affiliate thorname")),
  affiliateFee: optional(
    number()
      .describe("Affiliate fee in basis points")
      .refine((fee) => fee === Math.floor(fee) && fee >= 0, {
        message: "affiliateFee must be a positive integer",
        path: ["affiliateFee"],
      }),
  ),
  allowSmartContractSender: optional(boolean().describe("Allow smart contract as sender")),
  allowSmartContractReceiver: optional(boolean().describe("Allow smart contract as recipient")),
  disableSecurityChecks: optional(boolean().describe("Disable security checks")),
  includeTx: optional(
    boolean().describe("Set to true to include an transaction object (EVM only)"),
  ),
  cfBoost: optional(
    boolean().describe("Set to true to enable CF boost to speed up Chainflip swaps. BTC only."),
  ),
  referrer: optional(string().describe("Referrer address (referral program)")),
}).refine((data) => data.sellAsset !== data.buyAsset, {
  message: "Must be different",
  path: ["sellAsset", "buyAsset"],
});

export type QuoteRequest = z.infer<typeof QuoteRequestSchema>;

export const PriceRequestSchema = object({
  tokens: array(
    object({
      identifier: string(),
    }),
  ),
  metadata: boolean(),
});

export type PriceRequest = z.infer<typeof PriceRequestSchema>;

export const DepositChannelParamsSchema = object({
  destinationAddress: string(),
});

export const BrokerDepositChannelParamsSchema = DepositChannelParamsSchema.extend({
  sellAsset: object({
    chain: string(),
    asset: string(),
  }),
  buyAsset: object({
    chain: string(),
    asset: string(),
  }),
  channelMetadata: object({
    cfParameters: string().optional(),
    gasBudget: string().optional(),
    message: string().optional(),
  }).optional(),
  affiliateFees: array(
    object({
      brokerAddress: string(),
      feeBps: number(),
    }),
  ).optional(),
  refundParameters: object({
    minPrice: string().optional(),
    refundAddress: string().optional(),
    retryDuration: number().optional(),
  }).optional(),
  dcaParameters: object({
    chunkInterval: number().optional(),
    numberOfChunks: number().optional(),
  }).optional(),
  brokerCommissionBps: number().optional(),
  maxBoostFeeBps: number().optional(),
});

export type BrokerDepositChannelParams = z.infer<typeof BrokerDepositChannelParamsSchema>;

export const DepositChannelResponseSchema = object({
  channelId: string(),
  depositAddress: string(),
});

export const NearDepositChannelParamsSchema = DepositChannelParamsSchema.extend({
  sellAsset: string(),
  buyAsset: string(),
  sourceAddress: string(),
  sellAmount: string(),
  affiliateFees: object({
    nearId: string(),
    feeBps: number(),
  }).optional(),
  slippage: coerce.number(),
});

export type NearDepositChannelParams = z.infer<typeof NearDepositChannelParamsSchema>;

const NearQuoteResponseSchema = object({
  amountIn: string(),
  amountInFormatted: string(),
  amountInUsd: string(),
  minAmountIn: string(),
  amountOut: string(),
  amountOutFormatted: string(),
  amountOutUsd: string(),
  minAmountOut: string(),
  deadline: string().optional(),
  timeWhenInactive: string().optional(),
  timeEstimate: number().optional(),
});

export const NearDepositChannelResultSchema = NearQuoteResponseSchema.extend({
  timestamp: string(),
  signature: string(),
  quote: NearQuoteResponseSchema,
  tx: unknown(),
  depositAddress: string(),
});

export type NearDepositChannelResult = z.infer<typeof NearDepositChannelResultSchema>;

export const NearSwapResponseSchema = object({
  depositAddress: string(),
  depositAsset: string(),
  depositAmount: string(),
  buyAsset: string(),
  buyAssetAmount: string(),
  buyAssetAmountMaxSlippage: string(),
  tx: unknown(),
  deadline: string().optional(),
});

export type NearSwapResponse = z.infer<typeof NearSwapResponseSchema>;

export type DepositChannelResponse = z.infer<typeof DepositChannelResponseSchema>;

const TxnPayloadSchema = object({
  evmCalldata: optional(string()),
  logs: optional(unknown()),
  memo: optional(string()),
  spender: optional(string()), // used in evm approve transactions
});

export type TxnPayload = z.infer<typeof TxnPayloadSchema>;

// props that are most important while the transaction is live
const TxnTransientSchema = object({
  estimatedFinalisedAt: number(),
  estimatedTimeToComplete: number(),
  updatedAt: number(),
  currentLegIndex: optional(number()),
  providerDetails: optional(unknown()), // see ProviderTransientDetails
});

export type TxnTransient = z.infer<typeof TxnTransientSchema>;

const TransactionFeesSchema = object({
  network: optional(AssetValueSchema), // gas on ethereum, network fee on thorchain, etc.
  affiliate: optional(AssetValueSchema), // e.g. affiliate in memo, other affiliate mechanisms
  liquidity: optional(AssetValueSchema), // fee paid to pool
  protocol: optional(AssetValueSchema), // extra protocol fees (TS dex aggregation contracts, stargate fees, etc.)
  tax: optional(AssetValueSchema), // taxed tokens
});

export type TransactionFees = z.infer<typeof TransactionFeesSchema>;

const TxnMetaSchema = object({
  broadcastedAt: optional(number()),
  wallet: optional(string()),
  quoteId: optional(string()),
  explorerUrl: optional(string()),
  affiliate: optional(string()),
  fees: optional(TransactionFeesSchema),
  provider: optional(z.enum(ProviderName)),
  images: optional(
    object({
      from: optional(string()),
      to: optional(string()),
      provider: optional(string()),
      chain: optional(string()),
    }),
  ),
});

export type TxnMeta = z.infer<typeof TxnMetaSchema>;

const TransactionLegDTOSchema = z.object({
  chainId: z.enum(ChainId),
  hash: z.string(),
  block: z.number(),
  type: z.enum(TxnType),
  status: z.enum(TxnStatus),
  trackingStatus: z.optional(z.enum(TrackingStatus)),

  fromAsset: z.string(),
  fromAmount: z.string(),
  fromAddress: z.string(),
  toAsset: z.string(),
  toAmount: z.string(),
  toAddress: z.string(),
  finalAsset: z.optional(AssetValueSchema),
  finalAddress: z.optional(z.string()),

  finalisedAt: z.number(),

  transient: z.optional(TxnTransientSchema),
  meta: z.optional(TxnMetaSchema),
  payload: z.optional(TxnPayloadSchema),
});

export type TransactionLegDTO = z.infer<typeof TransactionLegDTOSchema>;

export const TrackerResponseSchema: z.ZodType<TransactionDTO> = TransactionLegDTOSchema.extend({
  legs: z.array(TransactionLegDTOSchema),
});

export type TrackerResponse = z.infer<typeof TrackerResponseSchema>;

export const TransactionSchema = TransactionLegDTOSchema.extend({
  legs: array(TransactionLegDTOSchema),
});

export type TransactionDTO = z.infer<typeof TransactionLegDTOSchema> & {
  legs: TransactionLegDTO[];
};

export const TransactionDTOSchema: ZodType<TransactionDTO> = TransactionLegDTOSchema.extend({
  legs: array(TransactionLegDTOSchema),
});

export const FeesSchema = array(
  object({
    type: z.enum(FeeTypeEnum),
    amount: string(),
    asset: string(),
    chain: string(),
    protocol: z.enum(ProviderName),
  }),
);

export type Fees = z.infer<typeof FeesSchema>;

export const EstimatedTimeSchema = z.object({
  inbound: z.optional(z.number().describe("Time to receive inbound asset in seconds")),
  swap: z.optional(z.number().describe("Time to swap assets in seconds")),
  outbound: z.optional(z.number().describe("Time to receive outbound asset in seconds")),
  total: z.number().describe("Total time in seconds"),
});

export type EstimatedTime = z.infer<typeof EstimatedTimeSchema>;

export const EVMTransactionSchema = object({
  to: string().describe("Address of the recipient"),
  from: string().describe("Address of the sender"),
  value: string().describe("Value to send"),
  data: string().describe("Data to send"),
});

export type EVMTransaction = z.infer<typeof EVMTransactionSchema>;

export const EVMTransactionDetailsParamsSchema = array(
  union([
    string(),
    number(),
    array(string()),
    object({ from: string(), value: string() }).describe(
      "Parameters to pass to the contract method",
    ),
  ]),
);

export type EVMTransactionDetailsParams = z.infer<typeof EVMTransactionDetailsParamsSchema>;

export const EVMTransactionDetailsSchema = object({
  contractAddress: string().describe("Address of the contract to interact with"),
  contractMethod: string().describe("Name of the method to call"),
  contractParams: EVMTransactionDetailsParamsSchema,
  contractParamNames: array(
    string().describe("Names of the parameters to pass to the contract method"),
  ),
  approvalToken: optional(string().describe("Address of the token to approve spending of")),
  approvalSpender: optional(string().describe("Address of the spender to approve")),
});

export type EVMTransactionDetails = z.infer<typeof EVMTransactionDetailsSchema>;

const EncodeObjectSchema = object({
  typeUrl: string(),
  value: unknown(),
});

const FeeSchema = object({
  amount: array(object({ denom: string(), amount: string() })),
  gas: string(),
});

export const CosmosTransactionSchema = object({
  memo: string(),
  accountNumber: number(),
  sequence: number(),
  chainId: z.enum(ChainId),
  msgs: array(EncodeObjectSchema),
  fee: FeeSchema,
});

export type CosmosTransaction = z.infer<typeof CosmosTransactionSchema>;

export const RouteLegSchema = object({
  sellAsset: string().describe("Asset to sell"),
  buyAsset: string().describe("Asset to buy"),
  provider: z.enum(ProviderName),
  sourceAddress: string().describe("Source address"),
  destinationAddress: string().describe("Destination address"),
  estimatedTime: EstimatedTimeSchema.optional(),
  affiliate: string().describe("Affiliate address").optional(),
  affiliateFee: number().describe("Affiliate fee").optional(),
  slipPercentage: number().describe("Slippage as a percentage"),
});

export type RouteLeg = z.infer<typeof RouteLegSchema>;

export const RouteLegWithoutAddressesSchema = RouteLegSchema.omit({
  sourceAddress: true,
  destinationAddress: true,
  slipPercentage: true,
});

export type RouteLegWithoutAddresses = z.infer<typeof RouteLegWithoutAddressesSchema>;

export const RouteQuoteMetadataAssetSchema = object({
  asset: string().describe("Asset name"),
  price: number().describe("Price in USD"),
  image: string().describe("Asset image"),
});

export type RouteQuoteMetadataAsset = z.infer<typeof RouteQuoteMetadataAssetSchema>;

export const ChainflipMetadataSchema = BrokerDepositChannelParamsSchema;

export type ChainflipMetadata = z.infer<typeof ChainflipMetadataSchema>;

export const RouteQuoteMetadataSchema = object({
  assets: optional(array(RouteQuoteMetadataAssetSchema)),
  tags: array(z.enum(PriorityLabel)),
  streamingInterval: number().optional(),
  maxStreamingQuantity: number().optional(),
  referrer: string().optional(),
});

export const RouteQuoteMetadataV2Schema = RouteQuoteMetadataSchema.extend({
  priceImpact: optional(number().describe("Price impact")),
  approvalAddress: optional(string().describe("Approval address for swap")),
  affiliate: optional(string()),
  affiliateFee: optional(string()),
  txType: optional(z.enum(RouteQuoteTxType)),
  chainflip: ChainflipMetadataSchema.optional(),
  near: NearDepositChannelParamsSchema.optional(),
  referrer: optional(string()),
});

export const RouteQuoteWarningSchema = array(
  object({ code: z.enum(WarningCodeEnum), display: string(), tooltip: string().optional() }),
);

export type RouteQuoteWarning = z.infer<typeof RouteQuoteWarningSchema>;

const QuoteResponseRouteLegItem = object({
  provider: z.enum(ProviderName),
  sellAsset: string().describe("Asset to sell"),
  sellAmount: string().describe("Sell amount"),
  buyAsset: string().describe("Asset to buy"),
  buyAmount: string().describe("Buy amount"),
  buyAmountMaxSlippage: string().describe("Buy amount max slippage"),
  fees: optional(FeesSchema),
});

const QuoteResponseRouteItem = object({
  providers: array(z.enum(ProviderName)),
  sellAsset: string().describe("Asset to sell"),
  sellAmount: string().describe("Sell amount"),
  buyAsset: string().describe("Asset to buy"),
  expectedBuyAmount: string().describe("Expected Buy amount"),
  expectedBuyAmountMaxSlippage: string().describe("Expected Buy amount max slippage"),
  sourceAddress: string().describe("Source address"),
  destinationAddress: string().describe("Destination address"),
  targetAddress: optional(string().describe("Target address")),
  inboundAddress: optional(string().describe("Inbound address")),
  expiration: optional(string().describe("Expiration")),
  memo: optional(string().describe("Memo")),
  fees: FeesSchema,
  txType: optional(z.enum(RouteQuoteTxType)),
  tx: optional(union([EVMTransactionSchema, CosmosTransactionSchema, string()])),
  estimatedTime: optional(EstimatedTimeSchema),
  totalSlippageBps: number().describe("Total slippage in bps"),
  legs: array(QuoteResponseRouteLegItem),
  warnings: RouteQuoteWarningSchema,
  meta: RouteQuoteMetadataV2Schema,
});

export const QuoteResponseSchema = object({
  quoteId: string().describe("Quote ID"),
  routes: array(QuoteResponseRouteItem),
  error: optional(string().describe("Error message")),
  providerErrors: optional(
    array(
      object({
        provider: z.enum(ProviderName).optional(),
        errorCode: optional(z.enum(ErrorCode)),
        message: optional(string()),
      }),
    ),
  ),
});

export type QuoteResponse = z.infer<typeof QuoteResponseSchema>;
export type QuoteResponseRoute = z.infer<typeof QuoteResponseRouteItem>;
export type QuoteResponseRouteLeg = z.infer<typeof QuoteResponseRouteLegItem>;

export const GasSchema = z.object({
  id: z.number(),
  chainId: z.enum(ChainId),
  value: z.string(),
  unit: z.string(),
  createdAt: z.date(),
});

const GasSchemaArray = z.array(GasSchema);

export const GasResponseSchema = z.union([GasSchema, GasSchemaArray]);

export type GasResponse = z.infer<typeof GasResponseSchema>;

const BalanceResponseSchema = array(
  object({
    chain: z.enum(Chain),
    decimal: number(),
    ticker: string(),
    symbol: string(),
    value: string(),
    identifier: string(),
  }),
);

export type BalanceResponse = z.infer<typeof BalanceResponseSchema>;
