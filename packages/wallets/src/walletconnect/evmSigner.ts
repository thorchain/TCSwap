/**
 * Based on code from SwapKit (https://github.com/swapkit/SwapKit),
 * licensed under the Apache License 2.0.
 * Modifications © 2025 Horizontal Systems.
 */

import { type EVMChain, USwapError, WalletOption } from "@uswap/helpers";
import type { JsonRpcProvider, Provider, TransactionRequest, TransactionResponse } from "ethers";
import { AbstractSigner } from "ethers";

import { DEFAULT_EIP155_METHODS } from "./constants";
import { chainToChainId, getAddressByChain } from "./helpers";
import type { Walletconnect } from "./index";

interface WalletconnectEVMSignerParams {
  chain: EVMChain;
  walletconnect: Walletconnect;
  provider: Provider | JsonRpcProvider;
}

class WalletconnectSigner extends AbstractSigner {
  address: string;

  private chain: EVMChain;
  private walletconnect: Walletconnect;
  readonly provider: Provider | JsonRpcProvider;

  constructor({ chain, provider, walletconnect }: WalletconnectEVMSignerParams) {
    super(provider);
    this.chain = chain;
    this.walletconnect = walletconnect;
    this.provider = provider;
    this.address = "";
  }

  // biome-ignore lint/suspicious/useAwait: fulfil implementation type
  getAddress = async () => {
    if (!this.walletconnect) {
      throw new USwapError("wallet_walletconnect_connection_not_established");
    }
    if (!this.address) {
      this.address = getAddressByChain(this.chain, this.walletconnect.accounts || []);
    }

    return this.address;
  };

  signMessage = async (message: string) => {
    // this is probably broken
    const txHash = (await this.walletconnect?.client.request({
      chainId: chainToChainId(this.chain),
      request: { method: DEFAULT_EIP155_METHODS.ETH_SIGN, params: [message] },
      topic: this.walletconnect.session.topic || "",
    })) as string;

    return txHash.startsWith("0x") ? txHash : `0x${txHash}`;
  };

  signTransaction = () => {
    throw new USwapError("wallet_walletconnect_method_not_supported", { method: "signTransaction" });

    // const baseTx = {
    //   from,
    //   to,
    //   value: BigNumber.from(value || 0).toHexString(),
    //   data,
    // };

    // const txHash = (await this.walletconnect?.client.request({
    //   chainId: chainToChainId(this.chain),
    //   topic: this.walletconnect.session.topic,
    //   request: {
    //     method: DEFAULT_EIP155_METHODS.ETH_SIGN_TRANSACTION,
    //     params: [baseTx],
    //   },
    // })) as string;

    // return txHash.startsWith('0x') ? txHash : `0x${txHash}`;
  };

  // ANCHOR (@Towan) - Implement in future
  signTypedData = () => {
    throw new USwapError("wallet_walletconnect_method_not_supported", { method: "signTypedData" });

    // const { toHexString } = await import('@uswap/toolboxes/evm');

    // const baseTx = {
    //   from,
    //   to,
    //   value: toHexString(value || 0n),
    //   data,
    // };

    // const txHash = (await this.walletconnect?.client.request({
    //   chainId: chainToChainId(this.chain),
    //   topic: this.walletconnect.session.topic,
    //   request: {
    //     method: DEFAULT_EIP155_METHODS.ETH_SIGN_TYPED_DATA,
    //     params: [baseTx],
    //   },
    // })) as string;

    // return txHash.startsWith('0x') ? txHash : `0x${txHash}`;
  };

  sendTransaction = async ({ from, to, value, data }: TransactionRequest) => {
    const { toHexString } = await import("@uswap/toolboxes/evm");

    const baseTx = { data, from, to, value: toHexString(BigInt(value || 0)) };
    const response = await this.walletconnect?.client.request({
      chainId: chainToChainId(this.chain),
      request: { method: DEFAULT_EIP155_METHODS.ETH_SEND_TRANSACTION, params: [baseTx] },
      topic: this.walletconnect.session.topic,
    });

    return response as TransactionResponse;
  };

  connect = (provider: Provider | null) => {
    if (!provider) {
      throw new USwapError({
        errorKey: "wallet_provider_not_found",
        info: { chain: this.chain, wallet: WalletOption.WALLETCONNECT },
      });
    }

    return new WalletconnectSigner({ chain: this.chain, provider, walletconnect: this.walletconnect });
  };
}
export const getEVMSigner = async ({ chain, walletconnect, provider }: WalletconnectEVMSignerParams) =>
  new WalletconnectSigner({ chain, provider, walletconnect });
