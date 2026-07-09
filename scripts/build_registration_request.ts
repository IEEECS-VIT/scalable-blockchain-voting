import { readFile } from "node:fs/promises";

import {
  encodeFunctionData,
  isAddress,
  isHex,
  type Address,
  type Hex,
} from "viem";

import {
  computeRegistrationPublicInputsHash,
  type Bytes32,
} from "../packages/crypto/src/index.js";

const voterRegistryAbi = [
  {
    type: "function",
    name: "registerWithProof",
    inputs: [
      { name: "identityNullifier", type: "bytes32" },
      { name: "votingKey", type: "address" },
      { name: "proof", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

type RegistrationRequestInput = {
  electionId: Bytes32;
  registryAddress: Address;
  identityNullifier: Bytes32;
  votingKey: Address;
  proof: Hex;
};

function usage(): never {
  throw new Error("Usage: npm run build:registration-request -- <registration-request-input.json>");
}

function assertBytes32(value: string, label: string): asserts value is Bytes32 {
  if (!isHex(value, { strict: true }) || value.length !== 66) {
    throw new Error(`${label} must be a 32-byte hex string`);
  }
}

function assertAddress(value: string, label: string): asserts value is Address {
  if (!isAddress(value)) {
    throw new Error(`${label} must be an Ethereum address`);
  }
  if (value.toLowerCase() === "0x0000000000000000000000000000000000000000") {
    throw new Error(`${label} cannot be the zero address`);
  }
}

function assertProof(value: string): asserts value is Hex {
  if (!isHex(value, { strict: true }) || value.length < 4) {
    throw new Error("proof must be non-empty hex bytes");
  }
}

async function main() {
  const inputPath = process.argv[2] ?? usage();
  const input = JSON.parse(await readFile(inputPath, "utf8")) as RegistrationRequestInput;
  assertBytes32(input.electionId, "electionId");
  assertAddress(input.registryAddress, "registryAddress");
  assertBytes32(input.identityNullifier, "identityNullifier");
  assertAddress(input.votingKey, "votingKey");
  assertProof(input.proof);

  const publicInputsHash = computeRegistrationPublicInputsHash({
    electionId: input.electionId,
    identityNullifier: input.identityNullifier,
    votingKey: input.votingKey,
  });
  const calldata = encodeFunctionData({
    abi: voterRegistryAbi,
    functionName: "registerWithProof",
    args: [
      input.identityNullifier.toLowerCase() as Bytes32,
      input.votingKey,
      input.proof,
    ],
  });

  console.log(JSON.stringify({
    registryAddress: input.registryAddress,
    method: "registerWithProof",
    identityNullifier: input.identityNullifier.toLowerCase(),
    votingKey: input.votingKey,
    publicInputsHash,
    relayerTransaction: {
      to: input.registryAddress,
      value: "0",
      data: calldata,
    },
    registerWithProofArgs: [
      input.identityNullifier.toLowerCase(),
      input.votingKey,
      input.proof,
    ],
  }, null, 2));
}

await main();
