import { Chain, filterSupportedChains, USwapError, WalletOption } from "@tcswap/helpers";
import { createWallet, getWalletSupportedChains } from "@tcswap/wallet-core";

// imported on demand: freighter-api touches `window` at module scope
const freighterApi = () => import("@stellar/freighter-api");

type FreighterApi = Awaited<ReturnType<typeof freighterApi>>;

function unwrap<T extends { error?: unknown }>(result: T, action: string): T {
  if (result.error) {
    const error = result.error as { message?: string } | string;
    throw new USwapError("wallet_freighter_request_failed", {
      action,
      message: (typeof error === "string" ? error : error.message) || `Freighter could not complete ${action}`,
    });
  }
  return result;
}

// Freighter announces itself via a postMessage handshake, not a window global
export async function isFreighterInstalled() {
  if (typeof window === "undefined") return false;
  try {
    const { isConnected } = await freighterApi();
    return !!(await isConnected()).isConnected;
  } catch {
    return false;
  }
}

async function assertMainnet(freighter: FreighterApi) {
  const { STELLAR_NETWORK_PASSPHRASE } = await import("@tcswap/toolboxes/stellar");
  const network = unwrap(await freighter.getNetwork(), "getNetwork");
  if (network.networkPassphrase !== STELLAR_NETWORK_PASSPHRASE) {
    throw new USwapError("wallet_freighter_wrong_network", {
      message: `Freighter is on ${network.network || "an unknown network"} — switch it to Stellar mainnet (Public)`,
    });
  }
}

// `silent` (page-load restore) never calls requestAccess, so it never opens a popup
async function getFreighterAddress(freighter: FreighterApi, { silent }: { silent: boolean }) {
  const { isAllowed } = unwrap(await freighter.isAllowed(), "isAllowed");
  const shared = isAllowed ? unwrap(await freighter.getAddress(), "getAddress").address : "";
  if (shared) return shared;

  if (silent) {
    throw new USwapError("wallet_freighter_request_failed", {
      action: "getAddress",
      message: isAllowed ? "Freighter is locked — unlock it and connect again" : "Freighter access was revoked",
    });
  }

  const { address } = unwrap(await freighter.requestAccess(), "requestAccess");
  if (!address) {
    throw new USwapError("wallet_freighter_request_failed", {
      action: "requestAccess",
      message: "Freighter did not share an account — unlock it and approve the connection",
    });
  }
  return address;
}

export const freighterWallet = createWallet({
  connect: ({ addChain, supportedChains, walletType }) =>
    async function connectFreighter(chains: Chain[], { silent = false }: { silent?: boolean } = {}) {
      const filteredChains = filterSupportedChains({ chains, supportedChains, walletType });
      if (filteredChains.length === 0) return false;

      if (!(await isFreighterInstalled())) {
        throw new USwapError("wallet_freighter_not_found", {
          message: "Freighter is not installed — add the extension from freighter.app",
        });
      }

      const freighter = await freighterApi();
      const address = await getFreighterAddress(freighter, { silent });
      await assertMainnet(freighter);

      const { getStellarToolbox, STELLAR_NETWORK_PASSPHRASE } = await import("@tcswap/toolboxes/stellar");

      const toolbox = await getStellarToolbox({
        signer: {
          getAddress: () => address,
          // `address` makes Freighter refuse if the user switched accounts
          signTransaction: async (xdr: string) => {
            await assertMainnet(freighter);
            const { signedTxXdr, signerAddress } = unwrap(
              await freighter.signTransaction(xdr, { address, networkPassphrase: STELLAR_NETWORK_PASSPHRASE }),
              "signTransaction",
            );
            if (signerAddress && signerAddress !== address) {
              throw new USwapError("wallet_freighter_signer_mismatch", {
                expected: address,
                message: "Freighter signed with a different account — switch back to the connected one",
                signer: signerAddress,
              });
            }
            return signedTxXdr;
          },
        },
      });

      addChain({ ...toolbox, address, balance: [], chain: Chain.Stellar, walletType });

      return true;
    },
  name: "connectFreighter",
  supportedChains: [Chain.Stellar],
  walletType: WalletOption.FREIGHTER,
});

export const FREIGHTER_SUPPORTED_CHAINS = getWalletSupportedChains(freighterWallet);
