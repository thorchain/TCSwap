import { describe, expect, test } from "bun:test";
import { AssetValue, Chain, type TCLikeChain } from "@tcswap/helpers";
import { TxBody } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { buildEncodedTxBody, depositMsgAmino, parseAminoMessageForDirectSigning } from "../thorchainUtils/messages";
import { $root } from "../thorchainUtils/types/MsgCompiled";

const SENDERS = {
  [Chain.Maya]: "maya1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq4n8gyj",
  [Chain.THORChain]: "thor1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq4yeyjz",
};

// Builds the deposit the way the toolbox does, encodes it, and decodes the asset back off the wire.
// protobufjs only sets a decoded field as an own property when it was on the wire.
async function encodedDepositAsset(chain: TCLikeChain, asset: string) {
  const assetValue = AssetValue.from({ asset, fromBaseDecimal: 8, value: "100000000" });
  const msg = parseAminoMessageForDirectSigning(
    depositMsgAmino({ assetValue, memo: "=:ETH.USDC:0x0", sender: SENDERS[chain] }),
  );
  const body = await buildEncodedTxBody({ chain, memo: "=:ETH.USDC:0x0", msgs: [msg] });
  const [encoded] = TxBody.decode(body).messages;

  return $root.types.MsgDeposit.decode(encoded?.value).coins[0].asset;
}

describe("MsgDeposit coin asset", () => {
  // mayanode's common.Asset has no `secured` field (6): an explicit `secured: false` on the wire
  // fails the broadcast with `errUnknownField "*common.Asset": {TagNum: 6}`.
  test("CACAO on Maya carries no false flags", async () => {
    const asset = await encodedDepositAsset(Chain.Maya, "MAYA.CACAO");

    expect(Object.keys(asset).sort()).toEqual(["chain", "symbol", "ticker"]);
    expect(asset).toMatchObject({ chain: "MAYA", symbol: "CACAO", ticker: "CACAO" });
  });

  // A bare "MAYA" denom used to parse back as MAYA.CACAO.
  test("the MAYA token on Maya stays MAYA", async () => {
    const asset = await encodedDepositAsset(Chain.Maya, "MAYA.MAYA");

    expect(Object.keys(asset).sort()).toEqual(["chain", "symbol", "ticker"]);
    expect(asset).toMatchObject({ chain: "MAYA", symbol: "MAYA", ticker: "MAYA" });
  });

  test("RUNE on THORChain carries no false flags", async () => {
    const asset = await encodedDepositAsset(Chain.THORChain, "THOR.RUNE");

    expect(Object.keys(asset).sort()).toEqual(["chain", "symbol", "ticker"]);
    expect(asset).toMatchObject({ chain: "THOR", symbol: "RUNE", ticker: "RUNE" });
  });

  test("secured asset on THORChain keeps its flag on the wire", async () => {
    const asset = await encodedDepositAsset(Chain.THORChain, "BTC-BTC");

    expect(Object.keys(asset).sort()).toEqual(["chain", "secured", "symbol", "ticker"]);
    expect(asset).toMatchObject({ chain: "BTC", secured: true, symbol: "BTC", ticker: "BTC" });
  });

  test("synth on THORChain keeps its flag on the wire", async () => {
    const asset = await encodedDepositAsset(Chain.THORChain, "BTC/BTC");

    expect(Object.keys(asset).sort()).toEqual(["chain", "symbol", "synth", "ticker"]);
    expect(asset).toMatchObject({ chain: "BTC", symbol: "BTC", synth: true, ticker: "BTC" });
  });
});
