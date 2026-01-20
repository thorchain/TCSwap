import type { EVMChain } from "@tcswap/helpers";
import { getBalance } from "../utils";

export function getEvmApi(chain: EVMChain) {
  return { getBalance: getBalance(chain) };
}

export function createCustomEvmApi(methods: ReturnType<typeof getEvmApi>) {
  return methods;
}
