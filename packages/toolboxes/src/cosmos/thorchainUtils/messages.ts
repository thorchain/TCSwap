/**
 * Modifications © 2025 Horizontal Systems.
 */

import type { TxBodyEncodeObject } from "@cosmjs/proto-signing";
import { AssetValue, Chain, getChainConfig, type TCLikeChain, USwapError } from "@tcswap/helpers";

import { createStargateClient, getDefaultChainFee, getDenomWithChain, getMsgSendDenom } from "../util";

import { createDefaultAminoTypes, createDefaultRegistry } from "./registry";
import type { ThorchainCreateTransactionParams } from "./types";

type MsgSend = ReturnType<typeof transferMsgAmino>;
type MsgDeposit = ReturnType<typeof depositMsgAmino>;
type DirectMsgSendForBroadcast = ReturnType<typeof parseAminoMessageForDirectSigning<MsgSend>>;
type DirectMsgDepositForBroadcast = ReturnType<typeof parseAminoMessageForDirectSigning<MsgDeposit>>;

export const THORCHAIN_GAS_VALUE = getDefaultChainFee(Chain.THORChain).gas;
export const MAYA_GAS_VALUE = getDefaultChainFee(Chain.Maya).gas;

export const transferMsgAmino = ({
  sender,
  recipient,
  assetValue,
}: {
  sender: string;
  recipient?: string;
  assetValue: AssetValue;
}) => {
  const chain = assetValue.chain as typeof Chain.THORChain | typeof Chain.Maya;
  return {
    type: `${chain === Chain.Maya ? "mayachain" : "thorchain"}/MsgSend` as const,
    value: {
      amount: [{ amount: assetValue.getBaseValue("string"), denom: getMsgSendDenom(assetValue.symbol, true) }],
      from_address: sender,
      to_address: recipient,
    },
  };
};

export const depositMsgAmino = ({
  sender,
  assetValue,
  memo = "",
}: {
  sender: string;
  assetValue: AssetValue;
  memo?: string;
}) => {
  const chain = assetValue.chain as TCLikeChain;
  return {
    type: `${chain === Chain.Maya ? "mayachain" : "thorchain"}/MsgDeposit` as const,
    value: {
      coins: [{ amount: assetValue.getBaseValue("string"), asset: getDenomWithChain(assetValue) }],
      memo,
      signer: sender,
    },
  };
};

export const buildAminoMsg = ({
  sender,
  recipient,
  assetValue,
  memo,
}: {
  sender: string;
  recipient?: string;
  assetValue: AssetValue;
  memo?: string;
}) => {
  const isDeposit = !recipient;
  const msg = isDeposit
    ? depositMsgAmino({ assetValue, memo, sender })
    : transferMsgAmino({ assetValue, recipient, sender });

  return msg;
};

export const convertToSignable = async (msg: MsgSend | MsgDeposit, chain: TCLikeChain) => {
  const aminoTypes = await createDefaultAminoTypes(chain);

  return aminoTypes.fromAmino(msg);
};

const getAccount = async ({ rpcUrl, sender }: { sender: string; rpcUrl: string }) => {
  const client = await createStargateClient(rpcUrl);
  const account = await client.getAccount(sender);

  if (!account) {
    throw new USwapError("toolbox_cosmos_account_not_found", { sender });
  }

  return account;
};

export function getCreateTransaction(rpcUrl: string) {
  return function createTransaction(params: ThorchainCreateTransactionParams) {
    const { assetValue, recipient, memo, sender, asSignable, asAminoMessage } = params;

    if (recipient) {
      return buildTransferTx(rpcUrl)({ asAminoMessage, asSignable, assetValue, memo, recipient, sender });
    }

    return buildDepositTx(rpcUrl)({ asAminoMessage, asSignable, assetValue, memo, sender });
  };
}

export const buildTransferTx =
  (rpcUrl: string) =>
  async ({
    sender,
    recipient,
    assetValue,
    memo = "",
    asSignable = true,
    asAminoMessage = false,
    sequence,
    accountNumber,
  }: ThorchainCreateTransactionParams) => {
    const account = await getAccount({ rpcUrl, sender });
    const chain = assetValue.chain as TCLikeChain;
    const { chainId } = getChainConfig(chain);

    const transferMsg = transferMsgAmino({ assetValue, recipient, sender });

    const msg = asSignable
      ? await convertToSignable(asAminoMessage ? transferMsg : parseAminoMessageForDirectSigning(transferMsg), chain)
      : transferMsg;

    const transaction = {
      accountNumber: accountNumber || account.accountNumber,
      chainId,
      fee: getDefaultChainFee(chain),
      memo,
      msgs: [msg],
      sequence: sequence || account.sequence,
    };

    return transaction;
  };

export const buildDepositTx =
  (rpcUrl: string) =>
  async ({
    sender,
    assetValue,
    memo = "",
    asSignable = true,
    asAminoMessage = false,
    sequence,
    accountNumber,
  }: ThorchainCreateTransactionParams) => {
    const account = await getAccount({ rpcUrl, sender });
    const chain = assetValue.chain as TCLikeChain;
    const { chainId } = getChainConfig(chain);

    const depositMsg = depositMsgAmino({ assetValue, memo, sender });

    const msg = asSignable
      ? await convertToSignable(
          asAminoMessage ? depositMsg : parseAminoMessageForDirectSigning<MsgDeposit>(depositMsg),
          chain,
        )
      : depositMsg;

    const transaction = {
      accountNumber: accountNumber || account.accountNumber,
      chainId,
      fee: getDefaultChainFee(chain),
      memo,
      msgs: [msg],
      sequence: sequence || account.sequence,
    };

    return transaction;
  };

export function parseAminoMessageForDirectSigning<T extends MsgDeposit | MsgSend>(msg: T) {
  if (msg.type === "thorchain/MsgSend" || msg.type === "mayachain/MsgSend") return msg as MsgSend;

  return {
    ...msg,
    value: {
      ...msg.value,
      coins: (msg as MsgDeposit).value.coins.map((coin: { asset: string; amount: string }) => {
        const assetValue = AssetValue.from({ asset: coin.asset });

        // Synth: chain="<L1>", symbol="<TICKER>", synth=true (e.g. BTC.BTC + synth=true).
        // Trade: chain="<L1>", symbol="<TICKER>", trade=true (proto carries the trade flag).
        // Secured: chain="<L1>", symbol="<TICKER>", secured=true (proto carries the secured flag).
        // Native (RUNE etc): chain="THOR", symbol="RUNE".
        let symbol = assetValue.symbol.toUpperCase();
        let chain = assetValue.chain.toUpperCase();

        if (assetValue.isSynthetic) {
          const [synthChain, synthSymbol] = assetValue.symbol.split("/");
          chain = (synthChain ?? chain).toUpperCase();
          symbol = (synthSymbol ?? assetValue.ticker).toUpperCase();
        } else if (assetValue.isTradeAsset) {
          const [tradeChain, tradeSymbol] = assetValue.symbol.split("~");
          chain = (tradeChain ?? chain).toUpperCase();
          symbol = (tradeSymbol ?? assetValue.ticker).toUpperCase();
        } else if (assetValue.isSecuredAsset) {
          const dashIndex = assetValue.symbol.indexOf("-");
          chain = (dashIndex > 0 ? assetValue.symbol.slice(0, dashIndex) : chain).toUpperCase();
          symbol = (dashIndex > 0 ? assetValue.symbol.slice(dashIndex + 1) : assetValue.ticker).toUpperCase();
        }

        return {
          ...coin,
          asset: {
            chain,
            secured: assetValue.isSecuredAsset,
            symbol,
            synth: assetValue.isSynthetic,
            ticker: assetValue.ticker,
            trade: assetValue.isTradeAsset,
          },
        };
      }),
    },
  };
}

export async function buildEncodedTxBody({
  chain,
  memo,
  msgs,
}: {
  msgs: DirectMsgDepositForBroadcast[] | DirectMsgSendForBroadcast[];
  memo: string;
  chain: TCLikeChain;
}) {
  const registry = await createDefaultRegistry();
  const aminoTypes = await createDefaultAminoTypes(chain);

  const signedTxBody: TxBodyEncodeObject = {
    typeUrl: "/cosmos.tx.v1beta1.TxBody",
    value: { memo, messages: msgs.map((msg) => aminoTypes.fromAmino(msg)) },
  };

  return registry.encode(signedTxBody);
}
