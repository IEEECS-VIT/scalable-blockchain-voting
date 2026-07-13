import { dirname, resolve } from "node:path";
import { readFile, writeFile } from "node:fs/promises";

import {
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  isAddress,
  keccak256,
  parseAbiParameters,
  type Address,
  type Hex,
} from "viem";

import { bytes32ToSnarkField } from "../packages/crypto/src/proofCompatibleBallot.js";

type Descriptor = {
  registryAddress: Address;
  electionId: Hex;
  identityNullifier: Hex;
  votingKey: Address;
  anonAadhaarProofPath: string;
  revealArray?: readonly [number, number, number, number];
};

type AnonAadhaarProof = {
  groth16Proof: {
    pi_a: readonly [string, string, ...string[]];
    pi_b: readonly [readonly [string, string], readonly [string, string], ...readonly string[][]];
    pi_c: readonly [string, string, ...string[]];
  };
  timestamp: string;
  nullifierSeed: string;
  nullifier: string;
  signalHash: string;
};

function packGroth16Proof(proof: AnonAadhaarProof["groth16Proof"]) {
  return [
    proof.pi_a[0],
    proof.pi_a[1],
    proof.pi_b[0][1],
    proof.pi_b[0][0],
    proof.pi_b[1][1],
    proof.pi_b[1][0],
    proof.pi_c[0],
    proof.pi_c[1],
  ] as const;
}

const registryAbi = [{
  type: "function",
  name: "registerWithProof",
  stateMutability: "nonpayable",
  inputs: [
    { name: "identityNullifier", type: "bytes32" },
    { name: "votingKey", type: "address" },
    { name: "proof", type: "bytes" },
  ],
  outputs: [],
}] as const;

const descriptorPath = process.argv[2];
const outputPath = process.argv[3];
if (descriptorPath === undefined || outputPath === undefined) {
  throw new Error(
    "usage: npm run build:anon-registration -- descriptor.json registration-artifact.json",
  );
}
const resolvedDescriptorPath = resolve(descriptorPath);
const descriptor = JSON.parse(
  await readFile(resolvedDescriptorPath, "utf8"),
) as Descriptor;
if (!isAddress(descriptor.registryAddress) || !isAddress(descriptor.votingKey)) {
  throw new Error("registryAddress or votingKey is invalid");
}
const anonProof = JSON.parse(
  await readFile(
    resolve(dirname(resolvedDescriptorPath), descriptor.anonAadhaarProofPath),
    "utf8",
  ),
) as AnonAadhaarProof;
const expectedNullifier = BigInt(descriptor.identityNullifier);
if (BigInt(anonProof.nullifier) !== expectedNullifier) {
  throw new Error("Anon Aadhaar nullifier does not match identityNullifier");
}
const expectedNullifierSeed = bytes32ToSnarkField(descriptor.electionId);
if (BigInt(anonProof.nullifierSeed) !== expectedNullifierSeed) {
  throw new Error("Anon Aadhaar nullifierSeed is not election-scoped");
}
const signalDomain = keccak256(
  new TextEncoder().encode("SVB_ANON_AADHAAR_REGISTRATION_SIGNAL_V1"),
);
const signal = BigInt(keccak256(
  encodeAbiParameters(
    parseAbiParameters(
      "bytes32 domain, bytes32 electionId, bytes32 identityNullifier, address votingKey",
    ),
    [
      signalDomain,
      descriptor.electionId,
      descriptor.identityNullifier,
      descriptor.votingKey,
    ],
  ),
));
const expectedSignalHash = BigInt(
  keccak256(encodePacked(["uint256"], [signal])),
) >> 3n;
if (BigInt(anonProof.signalHash) !== expectedSignalHash) {
  throw new Error("Anon Aadhaar signal does not bind this registration");
}
const revealArray = descriptor.revealArray ?? [0, 0, 0, 0];
const proofBytes = encodeAbiParameters(
  parseAbiParameters(
    "uint256 nullifierSeed, uint256 nullifier, uint256 timestamp, uint256 signal, uint256[4] revealArray, uint256[8] groth16Proof",
  ),
  [
    BigInt(anonProof.nullifierSeed),
    BigInt(anonProof.nullifier),
    BigInt(anonProof.timestamp),
    signal,
    revealArray.map(BigInt) as [bigint, bigint, bigint, bigint],
    packGroth16Proof(anonProof.groth16Proof).map(BigInt) as [
      bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint,
    ],
  ],
);
const calldata = encodeFunctionData({
  abi: registryAbi,
  functionName: "registerWithProof",
  args: [descriptor.identityNullifier, descriptor.votingKey, proofBytes],
});
const artifact = {
  system: "anon-aadhaar-v2.4.3",
  mock: false,
  registryAddress: descriptor.registryAddress,
  electionId: descriptor.electionId,
  identityNullifier: descriptor.identityNullifier,
  votingKey: descriptor.votingKey,
  nullifierSeed: anonProof.nullifierSeed,
  signal: signal.toString(),
  signalHash: anonProof.signalHash,
  proof: proofBytes,
  transaction: {
    to: descriptor.registryAddress,
    data: calldata,
    value: "0x0",
  },
};
await writeFile(resolve(outputPath), `${JSON.stringify(artifact, null, 2)}\n`);
console.log(JSON.stringify({ outputPath: resolve(outputPath), ...artifact }, null, 2));
