/**
 * Modifications © 2025 Horizontal Systems.
 */

import secp256k1 from "@bitcoinerlab/secp256k1";
import { networks as zcashNetworks } from "@bitgo/utxo-lib";
import { Chain, getRPCUrl, RequestClient, USwapConfig, USwapError, type UTXOChain, warnOnce } from "@tcswap/helpers";
import { address as btcAddress, initEccLib, networks } from "bitcoinjs-lib";
// @ts-expect-error
import coininfo from "coininfo";
import { uniqid } from "../../utils";

type BlockchairParams<T> = T & { chain: Chain; apiKey?: string };
type BlockchairFetchUnspentUtxoParams = BlockchairParams<{
  offset?: number;
  limit?: number;
  address: string;
  targetValue?: number;
  accumulativeValue?: number;
}>;

async function broadcastUTXOTx({ chain, txHash }: { chain: Chain; txHash: string }) {
  // Use Blockchair's push transaction endpoint (no API key needed)
  const url = `${baseUrl(chain)}/push/transaction`;
  const body = JSON.stringify({ data: txHash });

  try {
    const response = await RequestClient.post<{
      data: { transaction_hash: string } | null;
      context: { code: number; error?: string };
    }>(url, { body, headers: { "Content-Type": "application/json" } });

    if (response.context.code !== 200) {
      throw new USwapError("toolbox_utxo_broadcast_failed", {
        error: response.context.error || "Transaction broadcast failed",
      });
    }

    return response.data?.transaction_hash || txHash;
  } catch (error) {
    // Fallback to RPC if Blockchair fails
    const rpcUrl = await getRPCUrl(chain);
    if (rpcUrl) {
      const rpcBody = JSON.stringify({ id: uniqid(), jsonrpc: "2.0", method: "sendrawtransaction", params: [txHash] });

      const rpcResponse = await RequestClient.post<{
        id: string;
        result: string;
        error: { message: string; code?: number } | null;
      }>(rpcUrl, { body: rpcBody, headers: { "Content-Type": "application/json" } });

      if (rpcResponse.error) {
        throw new USwapError("toolbox_utxo_broadcast_failed", { error: rpcResponse.error?.message });
      }

      if (rpcResponse.result.includes('"code":-26')) {
        throw new USwapError("toolbox_utxo_invalid_transaction", { error: "Transaction amount was too low" });
      }

      return rpcResponse.result;
    }

    throw error;
  }
}

function baseUrl(chain: Chain) {
  const customUrl = USwapConfig.get("envs").blockchairApiUrl;
  const host = customUrl ?? "https://api.blockchair.com";
  return `${host}/${mapChainToBlockchairChain(chain)}`;
}

function getDefaultTxFeeByChain(chain: Chain) {
  switch (chain) {
    case Chain.Bitcoin:
      return 5;
    case Chain.Dogecoin:
      return 10000;
    case Chain.Litecoin:
      return 1;
    case Chain.Zcash:
      return 1;
    default:
      return 2;
  }
}

function mapChainToBlockchairChain(chain: Chain) {
  switch (chain) {
    case Chain.BitcoinCash:
      return "bitcoin-cash";
    case Chain.Litecoin:
      return "litecoin";
    case Chain.Dash:
      return "dash";
    case Chain.Dogecoin:
      return "dogecoin";
    case Chain.Zcash:
      return "zcash";
    case Chain.Polkadot:
      return "polkadot";
    default:
      return "bitcoin";
  }
}

async function getSuggestedTxFee(chain: Chain) {
  try {
    //Use Bitgo API for fee estimation
    //Refer: https://app.bitgo.com/docs/#operation/v2.tx.getfeeestimate
    const { feePerKb } = await RequestClient.get<{
      feePerKb: number;
      cpfpFeePerKb: number;
      numBlocks: number;
      feeByBlockTarget: { 1: number; 3: number };
    }>(`https://app.bitgo.com/api/v2/${chain.toLowerCase()}/tx/fee`);
    const suggestedFee = feePerKb / 1000;

    return Math.max(suggestedFee, getDefaultTxFeeByChain(chain));
  } catch {
    return getDefaultTxFeeByChain(chain);
  }
}

// Balance and UTXO reads run on every balance refresh. Where an Esplora fallback
// exists, a failure moves on to it at once instead of retrying (retries also
// spend the Blockchair quota); other chains keep the default retries.
const noRetry = { retry: { maxRetries: 0 }, timeoutMs: 10_000 };

async function blockchairRequest<T>(url: string, chain: Chain, apiKey?: string): Promise<T> {
  const response = await RequestClient.get<BlockchairResponse<T>>(
    `${url}${apiKey ? `${url.includes("?") ? "&" : "?"}key=${apiKey}` : ""}`,
    ESPLORA_HOSTS[chain] ? noRetry : undefined,
  );

  if (!response || response.context.code !== 200)
    throw new USwapError("toolbox_utxo_api_error", { error: `Failed to query ${url}` });

  return response.data as T;
}

async function getAddressData({ address, chain, apiKey }: BlockchairParams<{ address?: string }>) {
  if (!address) throw new USwapError("toolbox_utxo_invalid_params", { error: "Address is required" });

  try {
    return await withEsploraFallback(
      chain,
      async () => {
        const response = await blockchairRequest<BlockchairAddressResponse>(
          `${baseUrl(chain)}/dashboards/address/${address}?transaction_details=true`,
          chain,
          apiKey,
        );
        return response[address];
      },
      (host) => getEsploraAddressData(host, address),
    );
  } catch {
    return { address: { balance: 0, transaction_count: 0 }, utxo: [] };
  }
}

async function getUnconfirmedBalance({ address, chain, apiKey }: BlockchairParams<{ address?: string }>) {
  const response = await getAddressData({ address, apiKey, chain });

  return response?.address.balance || 0;
}

async function getRawTx({ chain, apiKey, txHash }: BlockchairParams<{ txHash?: string }>) {
  if (!txHash) throw new USwapError("toolbox_utxo_invalid_params", { error: "TxHash is required" });

  try {
    return await withEsploraFallback(
      chain,
      async () => {
        const rawTxResponse = await blockchairRequest<BlockchairRawTransactionResponse>(
          `${baseUrl(chain)}/raw/transaction/${txHash}`,
          chain,
          apiKey,
        );
        return rawTxResponse?.[txHash]?.raw_transaction || "";
      },
      (host) => esploraText(`${host}/tx/${txHash}/hex`),
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Failed to fetch raw transaction: ${errorMessage}`);
    return "";
  }
}

async function fetchUtxosBatch({ chain, address, apiKey, offset = 0, limit = 30 }: BlockchairFetchUnspentUtxoParams) {
  // Only fetch the fields we need to reduce payload size
  const fields = "is_spent,transaction_hash,index,value,script_hex,block_id,spending_signature_hex";

  const response = await blockchairRequest<BlockchairOutputsResponse[]>(
    // TODO - remove max value limit once we updated bitcoinjs-lib to support larger values
    `${baseUrl(chain)}/outputs?q=recipient(${address}),is_spent(false),value(..2000000000000000)&s=value(desc)&fields=${fields}&limit=${limit}&offset=${offset}`,
    chain,
    apiKey,
  );

  const txs = response.map(
    ({ is_spent, script_hex, block_id, transaction_hash, index, value, spending_signature_hex }) => ({
      hash: transaction_hash,
      index,
      is_confirmed: block_id !== -1,
      is_spent,
      script_hex,
      txHex: spending_signature_hex,
      value,
    }),
  );

  return txs;
}

function getTxsValue(txs: Awaited<ReturnType<typeof fetchUtxosBatch>>) {
  return txs.reduce((total, tx) => total + tx.value, 0);
}

function pickMostValuableTxs(
  txs: Awaited<ReturnType<typeof fetchUtxosBatch>>,
  targetValue?: number,
): Awaited<ReturnType<typeof fetchUtxosBatch>> {
  const sortedTxs = [...txs].sort((a, b) => b.value - a.value);

  if (targetValue) {
    const result = [];
    let accumulated = 0;

    for (const utxo of sortedTxs) {
      result.push(utxo);
      accumulated += utxo.value;
      if (accumulated >= targetValue) break;
    }

    return result;
  }

  return sortedTxs;
}

async function getUnspentUtxos({
  chain,
  address,
  apiKey,
  targetValue,
  accumulativeValue = 0,
  offset = 0,
  limit = 30,
}: BlockchairFetchUnspentUtxoParams): Promise<Awaited<ReturnType<typeof fetchUtxosBatch>>> {
  if (!address) throw new USwapError("toolbox_utxo_invalid_params", { error: "Address is required" });

  const utxos = await fetchUtxosBatch({ address, apiKey, chain, limit, offset, targetValue });
  const utxosCount = utxos.length;
  const isComplete = utxosCount < limit;

  const unspentUtxos = utxos.filter(({ is_spent }) => !is_spent);

  const unspentUtxosValue = getTxsValue(unspentUtxos);
  const totalCurrentValue = accumulativeValue + unspentUtxosValue;

  const limitReached = targetValue && totalCurrentValue >= targetValue;

  if (isComplete || limitReached) {
    return pickMostValuableTxs(unspentUtxos, targetValue);
  }

  const nextBatch = await getUnspentUtxos({
    accumulativeValue: totalCurrentValue,
    address,
    apiKey,
    chain,
    limit,
    offset: offset + limit,
    targetValue,
  });

  const allUtxos = [...unspentUtxos, ...nextBatch];

  return pickMostValuableTxs(allUtxos, targetValue);
}

async function getUtxos({
  address,
  chain,
  apiKey,
  fetchTxHex = true,
  targetValue,
}: BlockchairParams<{ address: string; fetchTxHex?: boolean; targetValue?: number }>) {
  // Errors used to be swallowed into an empty list, so an API outage (e.g. an
  // exhausted Blockchair key) surfaced as toolbox_utxo_insufficient_balance.
  let utxos: Awaited<ReturnType<typeof fetchUtxosBatch>>;
  try {
    utxos = await withEsploraFallback(
      chain,
      () => getUnspentUtxos({ address, apiKey, chain, targetValue }),
      async (host) => {
        const picked = pickMostValuableTxs(await getEsploraUtxos(host, address, chain), targetValue);
        // Take the raw txs from the same host rather than going back to Blockchair once per input.
        if (!fetchTxHex) return picked;
        return Promise.all(
          picked.map(async (utxo) => ({ ...utxo, txHex: await esploraText(`${host}/tx/${utxo.hash}/hex`) })),
        );
      },
    );
  } catch (error) {
    throw new USwapError({ errorKey: "toolbox_utxo_api_error", info: { address, chain } }, error);
  }

  const results = [];

  // `txHex` is only ever set by the Esplora path above (Blockchair's is the spending
  // signature, always null for an unspent output).
  for (const { hash, index, script_hex, value, txHex: fetchedTxHex } of utxos) {
    let txHex: string | undefined;
    if (fetchTxHex) {
      txHex = fetchedTxHex || (await getRawTx({ apiKey, chain, txHash: hash }));
    }
    results.push({
      address,
      hash,
      index,
      txHex,
      value,
      witnessUtxo: { script: Buffer.from(script_hex, "hex"), value },
    });
  }
  return results;
}

// Keyless Esplora APIs (CORS-enabled) that answer when Blockchair fails -- e.g.
// its key is out of quota. Tried in order after Blockchair.
const ESPLORA_HOSTS: Partial<Record<Chain, string[]>> = {
  [Chain.Bitcoin]: ["https://mempool.space/api", "https://blockstream.info/api"],
  [Chain.Litecoin]: ["https://litecoinspace.org/api"],
};

type EsploraUtxo = { txid: string; vout: number; value: number; status: { confirmed: boolean; block_height?: number } };
type EsploraStats = { funded_txo_sum: number; spent_txo_sum: number; tx_count: number };

async function withEsploraFallback<T>(chain: Chain, primary: () => Promise<T>, fallback: (host: string) => Promise<T>) {
  try {
    return await primary();
  } catch (error) {
    for (const host of ESPLORA_HOSTS[chain] ?? []) {
      try {
        return await fallback(host);
      } catch {
        // Next host.
      }
    }
    throw error;
  }
}

async function esploraText(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.text();
}

async function getEsploraUtxos(host: string, address: string, chain: Chain) {
  const utxos = await RequestClient.get<EsploraUtxo[]>(`${host}/address/${address}/utxo`, noRetry);
  // Esplora omits the output script; the toolbox needs it for the PSBT's witnessUtxo.
  // (Taproot addresses need the ECC lib to decode.)
  initEccLib(secp256k1);
  const script_hex = Buffer.from(btcAddress.toOutputScript(address, getUtxoNetwork()(chain))).toString("hex");

  return utxos.map(({ txid, vout, value, status }) => ({
    hash: txid,
    index: vout,
    is_confirmed: status.confirmed,
    is_spent: false,
    script_hex,
    txHex: null,
    value,
  }));
}

async function getEsploraAddressData(host: string, address: string) {
  const [{ chain_stats, mempool_stats }, utxos] = await Promise.all([
    RequestClient.get<{ chain_stats: EsploraStats; mempool_stats: EsploraStats }>(
      `${host}/address/${address}`,
      noRetry,
    ),
    RequestClient.get<EsploraUtxo[]>(`${host}/address/${address}/utxo`, noRetry),
  ]);

  return {
    address: {
      balance:
        chain_stats.funded_txo_sum -
        chain_stats.spent_txo_sum +
        mempool_stats.funded_txo_sum -
        mempool_stats.spent_txo_sum,
      transaction_count: chain_stats.tx_count + mempool_stats.tx_count,
    },
    transactions: [] as BlockchairTransaction[],
    utxo: utxos.map(({ txid, vout, value, status }) => ({
      block_id: status.block_height ?? -1,
      index: vout,
      transaction_hash: txid,
      value,
    })),
  } as BlockchairAddressResponse[string];
}

export function getUtxoApi(chain: UTXOChain) {
  const apiKey = USwapConfig.get("apiKeys").blockchair || "";

  warnOnce({
    condition: !apiKey,
    id: "no_blockchair_api_key_warning",
    warning: "No Blockchair API key found. Functionality will be limited.",
  });

  return {
    broadcastTx: (txHash: string) => broadcastUTXOTx({ chain, txHash }),
    getAddressData: (address: string) => getAddressData({ address, apiKey, chain }),
    getBalance: (address: string) => getUnconfirmedBalance({ address, apiKey, chain }),
    getRawTx: (txHash: string) => getRawTx({ apiKey, chain, txHash }),
    getSuggestedTxFee: () => getSuggestedTxFee(chain),
    getUtxos: (params: { address: string; fetchTxHex?: boolean; targetValue?: number }) =>
      getUtxos({ ...params, apiKey, chain }),
  };
}

/**
 * "Factory" to ensure typing for custom UTXO APIs
 */
export function createCustomUtxoApi(methods: ReturnType<typeof getUtxoApi>) {
  return methods;
}

export function getUtxoNetwork() {
  return function getNetwork(chain: Chain) {
    switch (chain) {
      case Chain.Bitcoin:
        return networks.bitcoin;
      case Chain.BitcoinCash:
        return coininfo.bitcoincash.main.toBitcoinJS();
      case Chain.Dash:
        return coininfo.dash.main.toBitcoinJS();
      case Chain.Litecoin:
        return coininfo.litecoin.main.toBitcoinJS();

      case Chain.Dogecoin: {
        const bip32 = { private: 0x04358394, public: 0x043587cf };
        const test = coininfo.dogecoin.test;
        test.versions.bip32 = bip32;
        return coininfo.dogecoin.main.toBitcoinJS();
      }

      case Chain.Zcash: {
        return zcashNetworks.zcash;
      }

      default:
        throw new USwapError("toolbox_utxo_not_supported", { chain });
    }
  };
}

interface BlockchairVin {
  txid: string;
  vout: number;
  scriptSig: { asm: string; hex: string };
  sequence: number;
}

interface BlockchairVout {
  value: number;
  n: number;
  scriptPubKey: { asm: string; hex: string; address: string; type: string; addresses: string[]; reqSigs: number };
}

interface BlockchairTransaction {
  block_id: number;
  hash: string;
  time: string;
  balance_change: number;
}

interface BlockchairUtxo {
  block_id: number;
  transaction_hash: string;
  index: number;
  value: number;
}

interface BlockchairAddressCoreData {
  type: string;
  script_hex: string;
  balance: number;
  balance_usd: number;
  received: number;
  received_usd: number;
  spent: number;
  spent_usd: number;
  output_count: number;
  unspent_output_count: number;
  first_seen_receiving: string;
  last_seen_receiving: string;
  first_seen_spending: null | string;
  last_seen_spending: null | string;
  transaction_count: number;
  scripthash_type: null | string;
}

interface BlockchairInputOutputCommonData {
  block_id: number;
  transaction_id: number;
  index: number;
  transaction_hash: string;
  date: string;
  time: string;
  value: number;
  value_usd: number;
  recipient: string;
  type: string;
  script_hex: string;
  is_from_coinbase: boolean;
  is_spendable: boolean | null;
  is_spent: boolean;
  lifespan: number | null;
  cdd: number | null;
}

interface BlockchairSpendingBlockData {
  spending_block_id: number | null;
  spending_transaction_id: number | null;
  spending_index: number | null;
  spending_transaction_hash: string | null;
  spending_date: string | null;
  spending_time: string | null;
  spending_value_usd: number | null;
  spending_sequence: number | null;
  spending_signature_hex: string | null;
  spending_witness: string | null;
}

interface BlockchairAddressResponse {
  [key: string]: { address: BlockchairAddressCoreData; transactions: BlockchairTransaction[]; utxo: BlockchairUtxo[] };
}

interface BlockchairOutputsResponse extends BlockchairSpendingBlockData, BlockchairInputOutputCommonData {}

interface BlockchairRawTransactionResponse {
  [key: string]: {
    raw_transaction: string;
    decoded_raw_transaction: {
      txid: string;
      hash: string;
      version: number;
      size: number;
      vsize: number;
      weight: number;
      locktime: number;
      vin: BlockchairVin[];
      vout: BlockchairVout[];
    };
  };
}

interface BlockchairResponse<T> {
  data: T;
  context: {
    code: number;
    source: string;
    results: number;
    state: number;
    market_price_usd: number;
    cache: { live: boolean; duration: number; since: string; until: string; time: any };
    api: {
      version: string;
      last_major_update: string;
      next_major_update: null | string;
      documentation: string;
      notice: string;
    };
    servers: string;
    time: number;
    render_time: number;
    full_time: number;
    request_cost: number;
  };
}
