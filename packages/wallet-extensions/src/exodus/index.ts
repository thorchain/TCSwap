/**
 * Modifications © 2025 Horizontal Systems.
 */

import { Chain, type EVMChain, EVMChains, filterSupportedChains, USwapError, WalletOption } from "@tcswap/helpers";
import type { SolanaProvider } from "@tcswap/toolboxes/solana";
import { createWallet, getWalletSupportedChains } from "@tcswap/wallet-core";
import type { Eip1193Provider } from "ethers";
import type { BitcoinProvider, GetAddressResponse } from "sats-connect";

/**
 * The Exodus browser extension, which is a different wallet from Exodus's Passkeys wallet in
 * `@tcswap/wallets/passkeys`.
 *
 * It publishes one provider per ecosystem: EIP-1193 for EVM chains, a Phantom-shaped one for Solana
 * and a Sats Connect one for Bitcoin. The first two live under `window.exodus`, a namespace nothing
 * else writes to. All three are also mirrored onto the shared `window.ethereum` / `window.solana` /
 * `window.BitcoinProvider` slots, but only when those are free or the user made Exodus their default
 * wallet - and a prioritised Exodus answers to `isMetaMask` and `isPhantom` too. A shared slot is
 * therefore never proof of identity, so each lookup below starts at Exodus's own namespace and falls
 * back to a shared provider only when it admits to being Exodus.
 */
const exodusEVMChains = [
  Chain.Arbitrum,
  Chain.Avalanche,
  Chain.Base,
  Chain.BinanceSmartChain,
  Chain.Ethereum,
  Chain.Optimism,
  Chain.Polygon,
] as const;

/** The rdns Exodus announces its EVM provider with over EIP-6963. */
const EXODUS_RDNS = "com.exodus.web3-wallet";

/** The Wallet Standard feature Exodus registers its Bitcoin provider under. */
const SATS_CONNECT_FEATURE = "sats-connect:";

type ExodusFlagged = { isExodus?: boolean };
type StandardWallet = { features?: Record<string, { provider?: unknown } | undefined> };
type WalletStandardApi = { register: (...wallets: StandardWallet[]) => () => void };

export const exodusWallet = createWallet({
  connect: ({ addChain, supportedChains, walletType }) =>
    async function connectExodus(chains: Chain[]) {
      const filteredChains = filterSupportedChains({ chains, supportedChains, walletType });

      const failures: unknown[] = [];

      const connectChain = async (chain: (typeof filteredChains)[number]) => {
        try {
          const { address, ...walletMethods } = await getWalletMethods(chain);

          addChain({ ...walletMethods, address, chain, walletType });
        } catch (error) {
          // A chain the user declined, or one Exodus does not hold, should not cost them the rest.
          failures.push(error);
          console.warn(`Exodus failed to connect ${chain}:`, error);
        }
      };

      // EVM chains one at a time, because connecting one switches the network Exodus is on and
      // parallel connects would leave it wherever the last finished. Bitcoin and Solana are separate
      // providers that touch none of that, so they run alongside rather than behind.
      const evmChains = filteredChains.filter((chain) => EVMChains.includes(chain as EVMChain));
      const otherChains = filteredChains.filter((chain) => !EVMChains.includes(chain as EVMChain));

      const connectEVMChains = async () => {
        for (const chain of evmChains) {
          await connectChain(chain);
        }
      };

      await Promise.all([connectEVMChains(), ...otherChains.map(connectChain)]);

      if (failures.length === filteredChains.length) throw failures[0];

      return true;
    },
  name: "connectExodus",
  supportedChains: [...exodusEVMChains, Chain.Bitcoin, Chain.Solana],
  walletType: WalletOption.EXODUS,
});

export const EXODUS_SUPPORTED_CHAINS = getWalletSupportedChains(exodusWallet);
export type ExodusSupportedChain = (typeof EXODUS_SUPPORTED_CHAINS)[number];

function getWalletMethods(chain: ExodusSupportedChain) {
  if (chain === Chain.Bitcoin) return getBitcoinWalletMethods();
  if (chain === Chain.Solana) return getSolanaWalletMethods();
  if (EVMChains.includes(chain as EVMChain)) return getEVMWalletMethods(chain as EVMChain);

  throw new USwapError("wallet_exodus_chain_not_supported", { chain });
}

async function getEVMWalletMethods(chain: EVMChain) {
  const walletProvider = getEVMProvider();
  if (!walletProvider) throw new USwapError("wallet_exodus_not_found");

  const { BrowserProvider } = await import("ethers");
  const { getWeb3WalletMethods } = await import("../evm-extensions");

  const provider = new BrowserProvider(walletProvider, "any");

  // `eth_accounts` answers silently when the site is already approved and the wallet unlocked, which
  // is every page load after the first; `eth_requestAccounts` is the call that opens Exodus.
  const approved: string[] = await provider.send("eth_accounts", []);
  if (approved.length === 0) await provider.send("eth_requestAccounts", []);

  const signer = await provider.getSigner();
  const address = await signer.getAddress();

  // Switches Exodus onto the requested network, and back onto it before every later call.
  const walletMethods = await getWeb3WalletMethods({ address, chain, provider, walletProvider });

  return { ...walletMethods, address };
}

async function getSolanaWalletMethods() {
  const provider = getSolanaProvider();
  if (!provider) throw new USwapError("wallet_exodus_not_found");

  const { getSolanaToolbox } = await import("@tcswap/toolboxes/solana");

  // `onlyIfTrusted` reconnects an already-approved site without opening Exodus, and rejects instead
  // of prompting when the site is new - which is when the visible connect is the right thing.
  // Exodus answers with the account and parks it on the provider; older builds only do the latter,
  // and answer with nothing at all, so neither result can be destructured.
  const connection = await provider.connect({ onlyIfTrusted: true }).catch(() => provider.connect());
  const address = (connection?.publicKey || provider.publicKey)?.toString();
  if (!address) throw new USwapError("wallet_exodus_no_address", { chain: Chain.Solana });

  const toolbox = await getSolanaToolbox({ signer: provider });

  return { ...toolbox, address };
}

async function getBitcoinWalletMethods() {
  const provider = getBitcoinProvider();
  if (!provider) throw new USwapError("wallet_exodus_bitcoin_not_found");

  const { getUtxoToolbox } = await import("@tcswap/toolboxes/utxo");
  const { Psbt } = await import("bitcoinjs-lib");
  // Imported here rather than at the top: Sats Connect and the JWT library it pulls in are ~130kB,
  // and only an Exodus user reaching for Bitcoin ever needs them.
  const {
    AddressPurpose,
    BitcoinNetworkType,
    getAddress,
    signTransaction: satsSignTransaction,
  } = await import("sats-connect");

  const BITCOIN_NETWORK = { type: BitcoinNetworkType.Mainnet };
  const getProvider = () => Promise.resolve(provider);

  // Exodus keeps the addresses it has already granted this site on the provider, so a reconnect
  // reads them instead of asking again - `getAddress` opens the wallet every single time.
  let address = grantedPaymentAddress(provider, AddressPurpose.Payment);

  if (!address) {
    await getAddress({
      getProvider,
      onCancel: () => {
        throw new USwapError("wallet_exodus_request_canceled");
      },
      onFinish: (response: GetAddressResponse) => {
        address = response.addresses[0]?.address || "";
      },
      payload: {
        message: "Address for receiving and sending payments",
        network: BITCOIN_NETWORK,
        purposes: [AddressPurpose.Payment],
      },
    });
  }

  if (!address) throw new USwapError("wallet_exodus_no_address", { chain: Chain.Bitcoin });

  // The toolbox builds the PSBT and finalises the signed one it gets back; Exodus signs the inputs
  // this address owns, which for a single-account wallet is all of them.
  async function signTransaction(psbt: InstanceType<typeof Psbt>) {
    let signedPsbt: InstanceType<typeof Psbt> | undefined;

    await satsSignTransaction({
      getProvider,
      onCancel: () => {
        throw new USwapError("wallet_exodus_signature_canceled");
      },
      onFinish: (response) => {
        signedPsbt = Psbt.fromBase64(response.psbtBase64);
      },
      payload: {
        broadcast: false,
        inputsToSign: [{ address, signingIndexes: psbt.txInputs.map((_, index) => index) }],
        message: "Sign transaction",
        network: BITCOIN_NETWORK,
        psbtBase64: psbt.toBase64(),
      },
    });

    if (!signedPsbt) throw new USwapError("wallet_exodus_sign_transaction_error");

    return signedPsbt;
  }

  const toolbox = await getUtxoToolbox(Chain.Bitcoin, {
    signer: { getAddress: () => Promise.resolve(address), signTransaction },
  });

  return { ...toolbox, address };
}

function getEVMProvider(): Eip1193Provider | undefined {
  const injected = window.exodus?.ethereum;
  if (injected) return injected;

  const announced = announcedEVMProvider();
  if (announced) return announced;

  return window.ethereum?.isExodus ? (window.ethereum as unknown as Eip1193Provider) : undefined;
}

/**
 * Exodus answers the EIP-6963 request event synchronously, so nothing has to be awaited here.
 */
function announcedEVMProvider(): Eip1193Provider | undefined {
  let announced: Eip1193Provider | undefined;

  const onAnnounce = (event: Event) => {
    const { info, provider } = (event as CustomEvent).detail || {};
    if (!announced && info?.rdns === EXODUS_RDNS) announced = provider;
  };

  window.addEventListener("eip6963:announceProvider", onAnnounce);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  window.removeEventListener("eip6963:announceProvider", onAnnounce);

  return announced;
}

function getSolanaProvider(): SolanaProvider | undefined {
  const provider = (window.exodus?.solana || window.solana) as (SolanaProvider & ExodusFlagged) | undefined;

  return provider?.isExodus ? provider : undefined;
}

/** The payment address Exodus has already granted this site, when there is one. */
function grantedPaymentAddress(provider: BitcoinProvider, payment: string) {
  const { accounts } = provider as { accounts?: { address?: string; purpose?: string }[] };

  return accounts?.find((account) => account.purpose === payment)?.address || "";
}

function getBitcoinProvider(): BitcoinProvider | undefined {
  const shared = window.BitcoinProvider as (BitcoinProvider & ExodusFlagged) | undefined;
  if (shared?.isExodus) return shared;

  // `window.BitcoinProvider` is first come, first served - Xverse and Leather claim it too - so when
  // one of them won it, Exodus is only reachable through its Wallet Standard registration.
  return standardWallets()
    .map((wallet) => wallet.features?.[SATS_CONNECT_FEATURE]?.provider as (BitcoinProvider & ExodusFlagged) | undefined)
    .find((provider) => provider?.isExodus);
}

/**
 * The app half of the Wallet Standard handshake: wallets already on the page answer `app-ready`,
 * while ones registering later announce themselves. Both are synchronous, so a single dispatch
 * collects everything registered by the time the user asks to connect.
 */
function standardWallets(): StandardWallet[] {
  const wallets: StandardWallet[] = [];
  const api: WalletStandardApi = {
    register: (...registered) => {
      wallets.push(...registered);
      return () => {};
    },
  };

  const onRegister = (event: Event) => (event as CustomEvent<(api: WalletStandardApi) => void>).detail(api);

  window.addEventListener("wallet-standard:register-wallet", onRegister);
  window.dispatchEvent(new CustomEvent("wallet-standard:app-ready", { detail: api }));
  window.removeEventListener("wallet-standard:register-wallet", onRegister);

  return wallets;
}
