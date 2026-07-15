import { performance } from "node:perf_hooks";

import { encodeAbiParameters, keccak256, parseAbiParameters, stringToHex } from "viem";

import { NullifierAccumulator, type Bytes32 } from "../packages/crypto/src/index.js";

const requestedCount = Number(process.argv[2] ?? "100000");
if (!Number.isInteger(requestedCount) || requestedCount <= 0 || requestedCount > 1_000_000) {
  throw new Error("count must be an integer from 1 to 1,000,000");
}
const domain = keccak256(stringToHex("SVB_SYNTHETIC_SCALE_BENCHMARK_V1"));
const nullifiers: Bytes32[] = [];
const generationStartedAt = performance.now();
for (let index = 0; index < requestedCount; index += 1) {
  nullifiers.push(keccak256(encodeAbiParameters(
    parseAbiParameters("bytes32 domain, uint64 index"),
    [domain, BigInt(index)],
  )));
}
const generationCompletedAt = performance.now();
const accumulator = new NullifierAccumulator();
const insertionStartedAt = performance.now();
accumulator.addMany(nullifiers);
const insertionCompletedAt = performance.now();

const result = {
  benchmarkVersion: 1,
  mode: "synthetic-nullifier-ingestion-not-real-proof-generation",
  count: requestedCount,
  uniqueCount: requestedCount,
  finalNullifierRoot: accumulator.root,
  generationMilliseconds: Number((generationCompletedAt - generationStartedAt).toFixed(2)),
  insertionMilliseconds: Number((insertionCompletedAt - insertionStartedAt).toFixed(2)),
  insertionRatePerSecond: Math.round(
    requestedCount / ((insertionCompletedAt - insertionStartedAt) / 1000),
  ),
  projectedOnchainCommitments: [64, 256, 1024, 4096].map((batchSize) => ({
    batchSize,
    transactionCount: Math.ceil(requestedCount / batchSize),
  })),
  exclusions: [
    "Groth16 proof generation",
    "Groth16 proof verification",
    "IPFS upload and retrieval",
    "network and relayer latency",
  ],
};
console.log(JSON.stringify(result, null, 2));
