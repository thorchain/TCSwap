import { afterEach, describe, expect, mock, test } from "bun:test";
import { Keypair, type Memo, type Operation, type Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import { AssetValue, Chain } from "@tcswap/helpers";
import { getStellarToolbox, STELLAR_NETWORK_PASSPHRASE, stellarValidateAddress } from "../index";

const USDC_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const YXLM_ISSUER = "GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55";

const sender = Keypair.random();
const recipient = Keypair.random();

const account = {
  balances: [
    { asset_type: "native", balance: "100.0000000", selling_liabilities: "10.0000000" },
    {
      asset_code: "USDC",
      asset_issuer: USDC_ISSUER,
      asset_type: "credit_alphanum4",
      balance: "50.0000000",
      selling_liabilities: "5.0000000",
    },
    { asset_code: "yXLM", asset_issuer: YXLM_ISSUER, asset_type: "credit_alphanum4", balance: "7.0000000" },
  ],
  sequence: "1000",
  subentry_count: 2,
};

const realFetch = globalThis.fetch;

/**
 * Horizon stand-in: `accounts` maps an address to its account (absent = 404); `submit` answers
 * POST /transactions; `landed` answers GET /transactions/{hash} (undefined = 404, not in a ledger).
 */
type Reply = { status: number; body: unknown };
type Landed = { successful: boolean } | undefined;

/** Arrays are answered in order, the last entry repeating once they run out. */
const sequence = <T>(value: T | T[]) => {
  const values = Array.isArray(value) ? value : [value];
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] as T;
};

function mockHorizon(accounts: Record<string, unknown>, submit?: Reply | Reply[], landed?: Landed | Landed[]) {
  const nextSubmit = sequence<Reply | undefined>(submit);
  const nextLanded = sequence<Landed>(landed);
  const fetchMock = mock((url: string, init?: RequestInit) => {
    const json = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status }));
    if (url.endsWith("/fee_stats")) return json(200, { max_fee: { p70: "250" } });
    if (url.endsWith("/transactions") && init?.method === "POST") {
      const reply = nextSubmit();
      return json(reply?.status ?? 200, reply?.body ?? {});
    }
    if (url.includes("/transactions/")) {
      const outcome = nextLanded();
      return outcome ? json(200, outcome) : json(404, {});
    }

    const address = decodeURIComponent(url.split("/accounts/")[1] ?? "");
    return accounts[address] ? json(200, accounts[address]) : json(404, {});
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const signer = {
  getAddress: () => sender.publicKey(),
  signTransaction: (xdr: string) => {
    const tx = TransactionBuilder.fromXDR(xdr, STELLAR_NETWORK_PASSPHRASE) as Transaction;
    tx.sign(sender);
    return tx.toXDR();
  },
};

const decode = (xdr: string) => TransactionBuilder.fromXDR(xdr, STELLAR_NETWORK_PASSPHRASE) as Transaction;

const values = (balances: AssetValue[]) => balances.map((b) => [b.ticker, b.getValue("string")]);

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("stellarValidateAddress", () => {
  test("accepts plain account addresses, rejects muxed and the rest", () => {
    expect(stellarValidateAddress(USDC_ISSUER)).toBe(true);
    expect(stellarValidateAddress("MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAAAAAAAACJUQ")).toBe(false);
    expect(stellarValidateAddress(USDC_ISSUER.toLowerCase())).toBe(false);
    expect(stellarValidateAddress(`${USDC_ISSUER.slice(0, -1)}A`)).toBe(false);
    expect(stellarValidateAddress("0x51176f5F0B7ccC8fA0376F08aaa28F316A38a2a0")).toBe(false);
  });
});

describe("balances", () => {
  test("getBalance lists every line with case-preserved codes", async () => {
    mockHorizon({ [sender.publicKey()]: account });
    const toolbox = getStellarToolbox({ signer });

    expect(values(await toolbox.getBalance())).toEqual([
      ["XLM", "100"],
      ["USDC", "50"],
      ["yXLM", "7"],
    ]);
  });

  test("getSpendableBalance holds back liabilities, and the reserve plus fee buffer on XLM", async () => {
    mockHorizon({ [sender.publicKey()]: account });
    const toolbox = getStellarToolbox({ signer });

    // XLM: 100 − liabilities 10 − reserve (2 + 2) × 0.5 − buffer 1 = 87
    expect(values(await toolbox.getSpendableBalance())).toEqual([
      ["XLM", "87"],
      ["USDC", "45"],
      ["yXLM", "7"],
    ]);
  });

  test("reserves the account pays for others count, ones a sponsor pays for it do not", async () => {
    mockHorizon({ [sender.publicKey()]: { ...account, num_sponsored: 1, num_sponsoring: 4 } });
    const [xlm] = await getStellarToolbox({ signer }).getSpendableBalance();

    // reserve (2 + 2 subentries + 4 sponsoring − 1 sponsored) × 0.5 = 3.5; 100 − 10 − 3.5 − 1 = 85.5
    expect(xlm?.getValue("string")).toBe("85.5");
  });

  test("an unfunded account reads as zero XLM", async () => {
    mockHorizon({});
    const balances = await getStellarToolbox().getBalance(sender.publicKey());
    expect(values(balances)).toEqual([["XLM", "0"]]);
  });
});

describe("createTransaction", () => {
  test("a native payment to an existing account", async () => {
    mockHorizon({ [recipient.publicKey()]: account, [sender.publicKey()]: account });
    const toolbox = getStellarToolbox({ signer });

    const tx = decode(
      await toolbox.createTransaction({
        assetValue: AssetValue.from({ chain: Chain.Stellar, value: "12.5" }),
        recipient: recipient.publicKey(),
      }),
    );
    const [op] = tx.operations as Operation.Payment[];

    expect(tx.source).toBe(sender.publicKey());
    expect(tx.sequence).toBe("1001");
    expect(tx.fee).toBe("250");
    expect(op?.type).toBe("payment");
    expect(op?.amount).toBe("12.5000000");
    expect(op?.asset.isNative()).toBe(true);
  });

  test("a native payment to a missing account creates it", async () => {
    mockHorizon({ [sender.publicKey()]: account });
    const toolbox = getStellarToolbox({ signer });

    const tx = decode(
      await toolbox.createTransaction({
        assetValue: AssetValue.from({ chain: Chain.Stellar, value: "5" }),
        recipient: recipient.publicKey(),
      }),
    );
    const [op] = tx.operations as Operation.CreateAccount[];

    expect(op?.type).toBe("createAccount");
    expect(op?.startingBalance).toBe("5.0000000");
  });

  test("a classic asset payment keeps the code's case", async () => {
    mockHorizon({ [recipient.publicKey()]: account, [sender.publicKey()]: account });
    const toolbox = getStellarToolbox({ signer });

    const tx = decode(
      await toolbox.createTransaction({
        assetValue: AssetValue.from({ asset: `XLM.yXLM-${YXLM_ISSUER}`, decimal: 7, value: "1.25" }),
        recipient: recipient.publicKey(),
      }),
    );
    const [op] = tx.operations as Operation.Payment[];

    expect(op?.asset.getCode()).toBe("yXLM");
    expect(op?.asset.getIssuer()).toBe(YXLM_ISSUER);
    expect(op?.amount).toBe("1.2500000");
  });

  test("a classic asset payment to a missing account is refused", async () => {
    mockHorizon({ [sender.publicKey()]: account });
    const toolbox = getStellarToolbox({ signer });

    await expect(
      toolbox.createTransaction({
        assetValue: AssetValue.from({ asset: `XLM.USDC-${USDC_ISSUER}`, decimal: 7, value: "1" }),
        recipient: recipient.publicKey(),
      }),
    ).rejects.toThrow();
  });

  test("a text memo stays MEMO_TEXT even when all digits; memoId becomes MEMO_ID", async () => {
    mockHorizon({ [recipient.publicKey()]: account, [sender.publicKey()]: account });
    const toolbox = getStellarToolbox({ signer });
    const assetValue = AssetValue.from({ chain: Chain.Stellar, value: "1" });

    const numericText: Memo = decode(
      await toolbox.createTransaction({ assetValue, memo: "0012345", recipient: recipient.publicKey() }),
    ).memo;
    const idMemo: Memo = decode(
      await toolbox.createTransaction({ assetValue, memoId: "123456789", recipient: recipient.publicKey() }),
    ).memo;
    const textMemo: Memo = decode(
      await toolbox.createTransaction({ assetValue, memo: "order-42", recipient: recipient.publicKey() }),
    ).memo;

    expect(numericText.type).toBe("text");
    expect(Buffer.from(numericText.value as Uint8Array).toString()).toBe("0012345");
    expect(idMemo.type).toBe("id");
    expect(idMemo.value).toBe("123456789");
    expect(textMemo.type).toBe("text");
    expect(Buffer.from(textMemo.value as Uint8Array).toString()).toBe("order-42");
  });
});

describe("broadcast", () => {
  test("signAndBroadcastTransaction submits the signed envelope and returns its hash", async () => {
    const fetchMock = mockHorizon(
      { [recipient.publicKey()]: account, [sender.publicKey()]: account },
      { body: { hash: "abc123" }, status: 200 },
    );
    const toolbox = getStellarToolbox({ signer });
    const xdr = await toolbox.createTransaction({
      assetValue: AssetValue.from({ chain: Chain.Stellar, value: "1" }),
      recipient: recipient.publicKey(),
    });

    expect(await toolbox.signAndBroadcastTransaction(xdr)).toBe("abc123");

    const submitted = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/transactions"));
    const signedXdr = new URLSearchParams(String(submitted?.[1]?.body)).get("tx") ?? "";
    expect(decode(signedXdr).signatures).toHaveLength(1);
  });

  test("a timed-out submission that landed anyway returns its hash", async () => {
    mockHorizon(
      { [recipient.publicKey()]: account, [sender.publicKey()]: account },
      { body: { title: "Timeout" }, status: 504 },
      { successful: true },
    );
    const toolbox = getStellarToolbox({ signer });
    const signed = await toolbox.signTransaction(
      await toolbox.createTransaction({
        assetValue: AssetValue.from({ chain: Chain.Stellar, value: "1" }),
        recipient: recipient.publicKey(),
      }),
    );

    expect(await toolbox.broadcastTransaction(signed)).toBe(Buffer.from(decode(signed).hash()).toString("hex"));
  });

  test("a rejection is not believed while the ledger shows the transaction landed", async () => {
    mockHorizon(
      { [recipient.publicKey()]: account, [sender.publicKey()]: account },
      { body: { extras: { result_codes: { transaction: "tx_bad_seq" } } }, status: 400 },
      { successful: true },
    );
    const toolbox = getStellarToolbox({ signer });
    const signed = await toolbox.signTransaction(
      await toolbox.createTransaction({
        assetValue: AssetValue.from({ chain: Chain.Stellar, value: "1" }),
        recipient: recipient.publicKey(),
      }),
    );

    expect(await toolbox.broadcastTransaction(signed)).toBe(Buffer.from(decode(signed).hash()).toString("hex"));
  });

  test("after a timeout, tx_bad_seq is not believed while Horizon has not ingested the ledger yet", async () => {
    mockHorizon(
      { [recipient.publicKey()]: account, [sender.publicKey()]: account },
      [
        { body: { title: "Timeout" }, status: 504 },
        { body: { extras: { result_codes: { transaction: "tx_bad_seq" } } }, status: 400 },
      ],
      [undefined, { successful: true }],
    );
    const toolbox = getStellarToolbox({ signer });
    const signed = await toolbox.signTransaction(
      await toolbox.createTransaction({
        assetValue: AssetValue.from({ chain: Chain.Stellar, value: "1" }),
        recipient: recipient.publicKey(),
      }),
    );

    expect(await toolbox.broadcastTransaction(signed)).toBe(Buffer.from(decode(signed).hash()).toString("hex"));
  }, 10_000);

  test("a rate-limited submission is not a rejection", async () => {
    mockHorizon(
      { [recipient.publicKey()]: account, [sender.publicKey()]: account },
      { body: { title: "Rate Limit Exceeded" }, status: 429 },
      { successful: true },
    );
    const toolbox = getStellarToolbox({ signer });
    const signed = await toolbox.signTransaction(
      await toolbox.createTransaction({
        assetValue: AssetValue.from({ chain: Chain.Stellar, value: "1" }),
        recipient: recipient.publicKey(),
      }),
    );

    expect(await toolbox.broadcastTransaction(signed)).toBe(Buffer.from(decode(signed).hash()).toString("hex"));
  });

  test("a transaction seen failing in the ledger is reported as failed", async () => {
    mockHorizon(
      { [recipient.publicKey()]: account, [sender.publicKey()]: account },
      { body: { title: "Timeout" }, status: 504 },
      { successful: false },
    );
    const toolbox = getStellarToolbox({ signer });
    const signed = await toolbox.signTransaction(
      await toolbox.createTransaction({
        assetValue: AssetValue.from({ chain: Chain.Stellar, value: "1" }),
        recipient: recipient.publicKey(),
      }),
    );

    await expect(toolbox.broadcastTransaction(signed)).rejects.toThrow();
  });

  test("a failed submission surfaces Horizon's result codes", async () => {
    mockHorizon(
      { [recipient.publicKey()]: account, [sender.publicKey()]: account },
      {
        body: { extras: { result_codes: { operations: ["op_under_dest_min"], transaction: "tx_failed" } } },
        status: 400,
      },
    );
    const toolbox = getStellarToolbox({ signer });
    const signed = await toolbox.signTransaction(
      await toolbox.createTransaction({
        assetValue: AssetValue.from({ chain: Chain.Stellar, value: "1" }),
        recipient: recipient.publicKey(),
      }),
    );

    const error = await toolbox.broadcastTransaction(signed).catch((e) => e);
    expect(error.cause.resultCodes).toEqual(["tx_failed", "op_under_dest_min"]);
  });
});
