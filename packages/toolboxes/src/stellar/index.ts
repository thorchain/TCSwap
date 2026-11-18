import {
  Asset,
  BASE_FEE,
  Memo,
  Networks,
  Operation,
  Account as StellarAccount,
  StrKey,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import {
  AssetValue,
  Chain,
  type ChainSigner,
  type GenericTransferParams,
  getChainConfig,
  USwapConfig,
  USwapError,
  USwapNumber,
} from "@tcswap/helpers";

/** Signs a base64 envelope and returns the signed envelope. */
export type StellarSigner = ChainSigner<string, string>;

export type StellarWallet = Awaited<ReturnType<typeof getStellarToolbox>>;

export const STELLAR_NETWORK_PASSPHRASE = Networks.PUBLIC;

// per ledger entry; a network parameter, 0.5 XLM since 2019
const BASE_RESERVE = 0.5;
const ACCOUNT_RESERVE_UNITS = 2;
const FEE_BUFFER = 1;
const MIN_ACCOUNT_BALANCE = ACCOUNT_RESERVE_UNITS * BASE_RESERVE;
const TX_TIMEOUT_SECONDS = 300;
const MAX_UINT64 = 2n ** 64n - 1n;
const SUBMIT_POLL_MS = 3000;
const UNBOUNDED_SUBMIT_WAIT_MS = 120_000;
// last ledger close + Horizon ingestion + clock skew past maxTime
const SUBMIT_GRACE_MS = 15_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type HorizonBalanceLine = {
  balance: string;
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  selling_liabilities?: string;
};

type HorizonAccount = {
  sequence: string;
  balances: HorizonBalanceLine[];
  subentry_count?: number;
  num_sponsoring?: number;
  num_sponsored?: number;
};

// G… only: Horizon /accounts and createAccount don't take muxed M… addresses
export function stellarValidateAddress(address: string) {
  return StrKey.isValidEd25519PublicKey(address);
}

function getHorizonUrl() {
  const configured = USwapConfig.get("rpcUrls")[Chain.Stellar]?.[0];
  return (configured || getChainConfig(Chain.Stellar).rpcUrls[0] || "https://horizon.stellar.org").replace(/\/$/, "");
}

function lineIdentifier(line: HorizonBalanceLine) {
  if (line.asset_type === "native") return "XLM.XLM";
  if (line.asset_code && line.asset_issuer) return `XLM.${line.asset_code}-${line.asset_issuer}`;
  return undefined;
}

function toStellarAsset(assetValue: AssetValue) {
  if (assetValue.chain !== Chain.Stellar) {
    throw new USwapError("toolbox_stellar_asset_not_supported", { asset: assetValue.toString() });
  }
  if (assetValue.isGasAsset) return Asset.native();

  if (!assetValue.address) {
    throw new USwapError("toolbox_stellar_asset_not_supported", { asset: assetValue.toString() });
  }
  return new Asset(assetValue.ticker, assetValue.address.toUpperCase());
}

function toStellarAmount(assetValue: AssetValue) {
  const stroops = assetValue.getBaseValue("bigint", 7);
  const whole = stroops / 10_000_000n;
  const fraction = (stroops % 10_000_000n).toString().padStart(7, "0");
  return `${whole}.${fraction}`;
}

// The provider's attachment decides the memo type: an all-digit text memo stays MEMO_TEXT.
function toMemo({ memo, memoId }: { memo?: string; memoId?: string }) {
  if (memoId) {
    if (!/^\d+$/.test(memoId) || BigInt(memoId) > MAX_UINT64) {
      throw new USwapError("toolbox_stellar_invalid_memo", { memoId });
    }
    return Memo.id(memoId);
  }
  return memo ? Memo.text(memo) : undefined;
}

function describeEnvelope(signedXdr: string) {
  const tx = TransactionBuilder.fromXDR(signedXdr, STELLAR_NETWORK_PASSPHRASE);
  const inner = "innerTransaction" in tx ? tx.innerTransaction : tx;
  const hash = Array.from(tx.hash(), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return { hash, maxTime: Number(inner.timeBounds?.maxTime ?? 0) };
}

const isAccepted = (status: number, body: { hash?: string }) => status >= 200 && status < 300 && !!body.hash;

// 429 is not a refusal: the submission was not looked at
const isRejection = (status: number) => status >= 400 && status < 500 && status !== 429;

export const getStellarToolbox = (params: { signer?: StellarSigner } = {}) => {
  const { signer } = params;
  const horizonUrl = getHorizonUrl();

  const getAddress = () => {
    if (!signer) throw new USwapError("toolbox_stellar_signer_not_found");
    return Promise.resolve(signer.getAddress());
  };

  // null when unfunded
  const getAccount = async (address: string): Promise<HorizonAccount | null> => {
    const res = await fetch(`${horizonUrl}/accounts/${encodeURIComponent(address)}`);
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new USwapError("toolbox_stellar_get_balance_error", { address, status: res.status });
    }
    return res.json();
  };

  const linesToAssetValues = (lines: { identifier: string; value: string }[]) =>
    lines.map(({ identifier, value }) =>
      AssetValue.from({ asset: identifier, decimal: getChainConfig(Chain.Stellar).baseDecimal, value }),
    );

  const getBalance = async (address?: string) => {
    const account = await getAccount(address || (await getAddress()));
    if (!account) return [AssetValue.from({ chain: Chain.Stellar })];

    return linesToAssetValues(
      account.balances.flatMap((line) => {
        const identifier = lineIdentifier(line);
        return identifier ? [{ identifier, value: line.balance }] : [];
      }),
    );
  };

  // reserve = (2 + subentries + sponsoring − sponsored) × 0.5 XLM; liabilities are open offers
  const getSpendableBalance = async (address?: string) => {
    const account = await getAccount(address || (await getAddress()));
    if (!account) return [AssetValue.from({ chain: Chain.Stellar })];

    const reserveUnits =
      ACCOUNT_RESERVE_UNITS +
      (account.subentry_count ?? 0) +
      (account.num_sponsoring ?? 0) -
      (account.num_sponsored ?? 0);
    const reserve = Math.max(0, reserveUnits) * BASE_RESERVE + FEE_BUFFER;

    return linesToAssetValues(
      account.balances.flatMap((line) => {
        const identifier = lineIdentifier(line);
        if (!identifier) return [];

        const locked = new USwapNumber(line.selling_liabilities ?? 0).add(line.asset_type === "native" ? reserve : 0);
        const total = new USwapNumber(line.balance);
        const spendable = total.gt(locked) ? total.sub(locked) : new USwapNumber(0);
        return [{ identifier, value: spendable.toFixed(7) }];
      }),
    );
  };

  const getFeeBid = async () => {
    try {
      const res = await fetch(`${horizonUrl}/fee_stats`);
      const stats = await res.json();
      return Math.max(Number(BASE_FEE), Number(stats?.max_fee?.p70) || 0);
    } catch {
      return Number(BASE_FEE);
    }
  };

  const estimateTransactionFee = async () => {
    const { baseDecimal } = getChainConfig(Chain.Stellar);
    return AssetValue.from({ chain: Chain.Stellar, fromBaseDecimal: baseDecimal, value: await getFeeBid() });
  };

  // unfunded destination: createAccount for XLM, refused for classic assets
  const createTransaction = async ({
    assetValue,
    recipient,
    memo,
    memoId,
    sender,
  }: {
    assetValue: AssetValue;
    recipient: string;
    sender?: string;
    memo?: string;
    memoId?: string;
  }) => {
    if (!stellarValidateAddress(recipient)) {
      throw new USwapError("core_transaction_invalid_recipient_address");
    }

    const from = sender || (await getAddress());
    const [source, destination, fee] = await Promise.all([getAccount(from), getAccount(recipient), getFeeBid()]);
    if (!source) throw new USwapError("toolbox_stellar_account_not_found", { address: from });

    const asset = toStellarAsset(assetValue);
    const amount = toStellarAmount(assetValue);

    let operation: ReturnType<typeof Operation.payment> | ReturnType<typeof Operation.createAccount>;
    if (destination) {
      operation = Operation.payment({ amount, asset, destination: recipient });
    } else if (asset.isNative() && Number(amount) >= MIN_ACCOUNT_BALANCE) {
      operation = Operation.createAccount({ destination: recipient, startingBalance: amount });
    } else {
      throw new USwapError("toolbox_stellar_account_not_found", { address: recipient });
    }

    const builder = new TransactionBuilder(new StellarAccount(from, source.sequence), {
      fee: String(fee),
      networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
    })
      .addOperation(operation)
      .setTimeout(TX_TIMEOUT_SECONDS);

    const stellarMemo = toMemo({ memo, memoId });
    if (stellarMemo) builder.addMemo(stellarMemo);

    return builder.build().toXDR();
  };

  const signTransaction = (xdr: string) => {
    if (!signer) throw new USwapError("toolbox_stellar_signer_not_found");
    return Promise.resolve(signer.signTransaction(xdr));
  };

  const submitOnce = async (signedXdr: string) => {
    try {
      const res = await fetch(`${horizonUrl}/transactions`, {
        body: new URLSearchParams({ tx: signedXdr }),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        method: "POST",
      });
      return { body: await res.json().catch(() => ({})), status: res.status };
    } catch {
      return { body: {}, status: 0 };
    }
  };

  const getTransactionOutcome = async (hash: string) => {
    try {
      const res = await fetch(`${horizonUrl}/transactions/${hash}`);
      if (!res.ok) return null;
      return Boolean((await res.json())?.successful);
    } catch {
      return null;
    }
  };

  const broadcastError = (body: any) => {
    const codes = body?.extras?.result_codes;
    const resultCodes = codes ? [codes.transaction, ...(codes.operations ?? [])].filter(Boolean) : [];
    return new USwapError("toolbox_stellar_broadcast_error", {
      message: resultCodes.length ? resultCodes.join(", ") : body?.title,
      resultCodes,
    });
  };

  const settleOutcome = (successful: boolean, hash: string, body: unknown) => {
    if (successful) return hash;
    throw broadcastError(body);
  };

  const settleAfterDeadline = async ({
    hash,
    horizonAnswered,
    lastBody,
    maxTime,
  }: {
    hash: string;
    horizonAnswered: boolean;
    lastBody: unknown;
    maxTime: number;
  }) => {
    const outcome = await getTransactionOutcome(hash);
    if (outcome !== null) return settleOutcome(outcome, hash, lastBody);
    if (maxTime > 0) throw broadcastError({ title: "Transaction expired before it was included" });
    // no time bound: may still land, if Horizon ever received it
    if (!horizonAnswered) throw broadcastError({ title: "Horizon could not be reached" });
    return hash;
  };

  // A 504/5xx/429/network error doesn't mean the tx failed, so from then on the outcome is
  // decided by looking the hash up and resubmitting (idempotent) until it lands, fails or expires.
  const broadcastTransaction = async (signedXdr: string) => {
    const { hash, maxTime } = describeEnvelope(signedXdr);
    const deadline = maxTime > 0 ? maxTime * 1000 + SUBMIT_GRACE_MS : Date.now() + UNBOUNDED_SUBMIT_WAIT_MS;

    let outcomeUnknown = false;
    let horizonAnswered = false;
    let lastBody: any = {};

    while (Date.now() <= deadline) {
      const { status, body } = await submitOnce(signedXdr);
      horizonAnswered ||= status !== 0;
      lastBody = body;
      if (isAccepted(status, body)) return body.hash as string;

      const rejected = isRejection(status);
      outcomeUnknown ||= !rejected;

      // a rejection like tx_bad_seq can follow an earlier submission that landed
      const outcome = await getTransactionOutcome(hash);
      if (outcome !== null) return settleOutcome(outcome, hash, body);
      if (rejected && !outcomeUnknown) throw broadcastError(body);

      await sleep(SUBMIT_POLL_MS);
    }

    return settleAfterDeadline({ hash, horizonAnswered, lastBody, maxTime });
  };

  // Provider-built envelopes are signed as given: Soroban footprints are simulated for that exact tx.
  const signAndBroadcastTransaction = async (xdr: string) => broadcastTransaction(await signTransaction(xdr));

  const transfer = async ({ assetValue, recipient, memo, memoId }: GenericTransferParams & { memoId?: string }) => {
    const sender = await getAddress();
    const xdr = await createTransaction({ assetValue, memo, memoId, recipient, sender });
    return signAndBroadcastTransaction(xdr);
  };

  return {
    broadcastTransaction,
    createTransaction,
    estimateTransactionFee,
    getAddress,
    getBalance,
    getSpendableBalance,
    signAndBroadcastTransaction,
    signer,
    signTransaction,
    transfer,
    validateAddress: stellarValidateAddress,
  };
};
