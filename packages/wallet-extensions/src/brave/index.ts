/**
 * Modifications © 2025 Horizontal Systems.
 */

import { Chain, type EVMChain, EVMChains, filterSupportedChains, USwapError, WalletOption } from "@tcswap/helpers";
import type { SolanaProvider } from "@tcswap/toolboxes/solana";
import { createWallet, getWalletSupportedChains } from "@tcswap/wallet-core";
import type { Eip1193Provider } from "ethers";

/**
 * Brave Wallet: an EVM account (`window.braveEthereum`) and a Solana account (`window.braveSolana`).
 * The shared `window.ethereum` / `window.solana` slots count as Brave only when they carry `isBraveWallet`.
 */
const BRAVE_RDNS = "com.brave.wallet";

const connectedEVMChains = new Set<EVMChain>();

type BraveFlagged = { isBraveWallet?: boolean };
type Listenable<Event extends string, Handler> = {
  on?: (event: Event, handler: Handler) => void;
  removeListener?: (event: Event, handler: Handler) => void;
};

type BraveEVMProvider = Eip1193Provider & BraveFlagged & Listenable<"accountsChanged", (accounts: string[]) => void>;
type BraveSolanaProvider = SolanaProvider &
  BraveFlagged &
  Listenable<"accountChanged", (publicKey: { toString(): string } | null) => void>;

export const braveWallet = createWallet({
  connect: ({ addChain, supportedChains, walletType }) =>
    async function connectBrave(chains: Chain[]) {
      const filteredChains = filterSupportedChains({ chains, supportedChains, walletType });

      const failures: unknown[] = [];

      const connectChain = async (chain: (typeof filteredChains)[number]) => {
        try {
          const { address, ...walletMethods } = await getWalletMethods(chain);

          addChain({ ...walletMethods, address, chain, walletType });
        } catch (error) {
          failures.push(error);
          console.warn(`Brave Wallet failed to connect ${chain}:`, error);
        }
      };

      // EVM chains share one provider, so only the first connect opens Brave's approval.
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
  name: "connectBrave",
  supportedChains: [...EVMChains, Chain.Solana],
  walletType: WalletOption.BRAVE,
});

export const BRAVE_SUPPORTED_CHAINS = getWalletSupportedChains(braveWallet);
export type BraveSupportedChain = (typeof BRAVE_SUPPORTED_CHAINS)[number];

function getWalletMethods(chain: BraveSupportedChain) {
  if (chain === Chain.Solana) return getSolanaWalletMethods();
  if (EVMChains.includes(chain as EVMChain)) return getEVMWalletMethods(chain as EVMChain);

  throw new USwapError("wallet_brave_chain_not_supported", { chain });
}

async function getEVMWalletMethods(chain: EVMChain) {
  const walletProvider = getBraveEVMProvider();
  if (!walletProvider) throw new USwapError("wallet_brave_evm_not_found");

  const { BrowserProvider } = await import("ethers");
  const { getWeb3WalletMethods } = await import("../evm-extensions");

  const provider = new BrowserProvider(walletProvider, "any");

  // `eth_accounts` answers without a prompt once the site is approved.
  const approved: string[] = await provider.send("eth_accounts", []);
  if (approved.length === 0) await provider.send("eth_requestAccounts", []);

  const signer = await provider.getSigner();
  const address = await signer.getAddress();

  const walletMethods = await getWeb3WalletMethods({ address, chain, provider, walletProvider });

  // The permission covers every EVM chain, so revoke only when the last one disconnects. A build
  // without `wallet_revokePermissions` must not throw.
  connectedEVMChains.add(chain);
  const disconnect = () => {
    connectedEVMChains.delete(chain);
    if (connectedEVMChains.size > 0) return Promise.resolve();

    return provider.send("wallet_revokePermissions", [{ eth_accounts: {} }]).then(
      () => undefined,
      () => undefined,
    );
  };

  return { ...walletMethods, address, disconnect };
}

async function getSolanaWalletMethods() {
  const provider = getBraveSolanaProvider();
  if (!provider) throw new USwapError("wallet_brave_solana_not_found");

  const { getSolanaToolbox } = await import("@tcswap/toolboxes/solana");

  // `onlyIfTrusted` reconnects an approved site silently and rejects on a new one.
  const connection = await provider.connect({ onlyIfTrusted: true }).catch(() => provider.connect());
  const address = (connection?.publicKey || provider.publicKey)?.toString();
  if (!address) throw new USwapError("wallet_brave_no_address", { chain: Chain.Solana });

  const toolbox = await getSolanaToolbox({ signer: provider });
  const disconnect = () => provider.disconnect().catch(() => undefined);

  return { ...toolbox, address, disconnect };
}

/** EIP-6963 goes last: requesting it makes every installed EVM wallet announce itself. */
export function getBraveEVMProvider(): BraveEVMProvider | undefined {
  const injected = (window as { braveEthereum?: BraveEVMProvider }).braveEthereum;
  if (injected) return injected;

  if (window.ethereum?.isBraveWallet) return window.ethereum as unknown as BraveEVMProvider;

  return announcedEVMProvider();
}

export function getBraveSolanaProvider(): BraveSolanaProvider | undefined {
  const injected = window.braveSolana as BraveSolanaProvider | undefined;
  if (injected) return injected;

  const shared = window.solana as BraveSolanaProvider | undefined;
  return shared?.isBraveWallet ? shared : undefined;
}

/**
 * Calls `onChange` when the user switches account on either side, with `undefined` when the Solana
 * account switched to is not connected to the site. Locking the EVM side is not a switch. Returns the unsubscribe.
 */
export function watchBraveAccounts(onChange: (address: string | undefined) => void) {
  const evm = getBraveEVMProvider();
  const solana = getBraveSolanaProvider();

  const onEVMAccounts = (accounts: string[]) => {
    if (accounts[0]) onChange(accounts[0]);
  };
  const onSolanaAccount = (publicKey: { toString(): string } | null) => onChange(publicKey?.toString());

  evm?.on?.("accountsChanged", onEVMAccounts);
  solana?.on?.("accountChanged", onSolanaAccount);

  return () => {
    evm?.removeListener?.("accountsChanged", onEVMAccounts);
    solana?.removeListener?.("accountChanged", onSolanaAccount);
  };
}

/** Brave answers the EIP-6963 request synchronously. */
function announcedEVMProvider(): BraveEVMProvider | undefined {
  let announced: BraveEVMProvider | undefined;

  const onAnnounce = (event: Event) => {
    const { info, provider } = (event as CustomEvent).detail || {};
    if (!announced && info?.rdns === BRAVE_RDNS) announced = provider;
  };

  window.addEventListener("eip6963:announceProvider", onAnnounce);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  window.removeEventListener("eip6963:announceProvider", onAnnounce);

  return announced;
}
