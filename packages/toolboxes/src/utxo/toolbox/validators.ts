import { networks, address as zcashAddress } from "@bitgo/utxo-lib";
import { bech32m } from "@scure/base";
import bs58check from "bs58check";
import { UtxoNetwork as bchNetwork, detectAddressNetwork, isValidAddress } from "../helpers";

export function stripPrefix(address: string) {
  return address.replace(/(bchtest:|bitcoincash:)/, "");
}

export function bchValidateAddress(address: string) {
  const strippedAddress = stripPrefix(address);
  return isValidAddress(strippedAddress) && detectAddressNetwork(strippedAddress) === bchNetwork.Mainnet;
}

// ZIP-320 TEX address prefixes and the t-address (P2PKH) version bytes that carry the same key hash.
const TEX_P2PKH_VERSIONS: Record<string, number[]> = { tex: [0x1c, 0xb8], textest: [0x1d, 0x25] };

/**
 * A TEX address (ZIP-320, `tex1…`) is a bech32m encoding of a P2PKH key hash that may only be paid from
 * transparent inputs. Returns the t-address with the same key hash - the identical output script - or
 * undefined when the address is not a TEX address. THORChain's ZEC vault advertises its inbound address
 * this way.
 */
export function texToTransparentAddress(address: string) {
  try {
    const { prefix, bytes } = bech32m.decodeToBytes(address.toLowerCase() as `${string}1${string}`);
    const version = TEX_P2PKH_VERSIONS[prefix];

    if (!version || bytes.length !== 20) return undefined;

    return bs58check.encode(Uint8Array.from([...version, ...bytes]));
  } catch {
    return undefined;
  }
}

export function validateZcashAddress(zcashAddressOrTex: string): boolean {
  const address = texToTransparentAddress(zcashAddressOrTex) ?? zcashAddressOrTex;

  try {
    if (address.startsWith("z")) {
      console.warn("Shielded Zcash addresses (z-addresses) are not supported. Use transparent addresses (t1/t3) only.");
      return false;
    }

    const network = networks.zcash;

    try {
      zcashAddress.toOutputScript(address, network);
      return true;
    } catch {
      const decoded = bs58check.decode(address);
      if (decoded.length < 21) return false;

      const version = decoded[0];
      return version === network.pubKeyHash || version === network.scriptHash;
    }
  } catch {
    return false;
  }
}
