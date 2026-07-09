import { readFile } from "node:fs/promises";

import {
  createWalletClient,
  http,
  isAddress,
  isHex,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

type RelayerTransaction = {
  to: Address;
  value: string;
  data: Hex;
};

type RegistrationRelayerArtifact = {
  publicInputsHash?: Hex;
  relayerTransaction: RelayerTransaction;
};

function usage(): never {
  throw new Error("Usage: npm run submit:registration-relayer -- <registration-request-artifact.json> [--dry-run]");
}

function assertAddress(value: string, label: string): asserts value is Address {
  if (!isAddress(value)) {
    throw new Error(`${label} must be an Ethereum address`);
  }
  if (value.toLowerCase() === "0x0000000000000000000000000000000000000000") {
    throw new Error(`${label} cannot be the zero address`);
  }
}

function assertHexBytes(value: string, label: string): asserts value is Hex {
  if (!isHex(value, { strict: true }) || value.length < 4) {
    throw new Error(`${label} must be non-empty hex bytes`);
  }
}

function assertPrivateKey(value: string | undefined): asserts value is Hex {
  if (value === undefined || value.trim() === "") {
    throw new Error("RELAYER_PRIVATE_KEY is required unless --dry-run is used");
  }
  if (!isHex(value, { strict: true }) || value.length !== 66) {
    throw new Error("RELAYER_PRIVATE_KEY must be a 32-byte hex private key");
  }
}

function rpcUrl() {
  const value = process.env.RELAYER_RPC_URL ?? process.env.AMOY_RPC_URL;
  if (value === undefined || value.trim() === "") {
    throw new Error("RELAYER_RPC_URL or AMOY_RPC_URL is required unless --dry-run is used");
  }
  return value;
}

function validateRelayerTransaction(
  transaction: RelayerTransaction,
): RelayerTransaction & { valueWei: bigint } {
  assertAddress(transaction.to, "relayerTransaction.to");
  assertHexBytes(transaction.data, "relayerTransaction.data");
  const valueWei = BigInt(transaction.value);
  if (valueWei !== 0n) {
    throw new Error("registration relayer transaction must not transfer value");
  }
  return {
    to: transaction.to,
    value: transaction.value,
    valueWei,
    data: transaction.data,
  };
}

async function main() {
  const inputPath = process.argv.find((arg) => arg.endsWith(".json")) ?? usage();
  const dryRun = process.argv.includes("--dry-run");
  const artifact = JSON.parse(
    await readFile(inputPath, "utf8"),
  ) as RegistrationRelayerArtifact;
  const transaction = validateRelayerTransaction(artifact.relayerTransaction);

  if (dryRun) {
    const maybePrivateKey = process.env.RELAYER_PRIVATE_KEY;
    const relayerAddress = maybePrivateKey !== undefined && maybePrivateKey.trim() !== ""
      ? privateKeyToAccount(maybePrivateKey as Hex).address
      : null;
    console.log(JSON.stringify({
      dryRun: true,
      submitted: false,
      relayerAddress,
      publicInputsHash: artifact.publicInputsHash,
      transaction: {
        to: transaction.to,
        value: transaction.value,
        data: transaction.data,
      },
    }, null, 2));
    return;
  }

  assertPrivateKey(process.env.RELAYER_PRIVATE_KEY);
  const account = privateKeyToAccount(process.env.RELAYER_PRIVATE_KEY);
  const client = createWalletClient({
    account,
    transport: http(rpcUrl()),
  });
  const transactionHash = await client.sendTransaction({
    chain: null,
    to: transaction.to,
    value: transaction.valueWei,
    data: transaction.data,
  });

  console.log(JSON.stringify({
    dryRun: false,
    submitted: true,
    relayerAddress: account.address,
    publicInputsHash: artifact.publicInputsHash,
    transactionHash,
  }, null, 2));
}

await main();
