import { dirname, resolve } from "node:path";
import { readFile, writeFile } from "node:fs/promises";

import { NullifierAccumulator, type Bytes32 } from "../packages/crypto/src/index.js";
import {
  buildEligibleBatchManifest,
  buildEligibleInclusionReceipt,
  parseEligibleVotePackageJson,
  type StoredEligibleVotePackageV3,
} from "../packages/crypto/src/eligiblePipeline.js";

type BatchInput = {
  electionId: Bytes32;
  eligibilityRoot: Bytes32;
  previousNullifierRoot: Bytes32;
  knownPreviousNullifiers?: readonly Bytes32[];
  verificationKeyPath?: string;
  packages: readonly { contentId: string; path: string }[];
};

const inputPath = process.argv[2];
const outputPath = process.argv[3];
if (inputPath === undefined || outputPath === undefined) {
  throw new Error("usage: npm run build:batch:v3 -- batch-input.json batch-artifact-v3.json");
}

const resolvedInputPath = resolve(inputPath);
const inputDirectory = dirname(resolvedInputPath);
const input = JSON.parse(await readFile(resolvedInputPath, "utf8")) as BatchInput;
if (!Array.isArray(input.packages) || input.packages.length === 0) {
  throw new Error("batch input must include eligible V3 vote packages");
}
const verificationKey = JSON.parse(await readFile(
  input.verificationKeyPath === undefined
    ? resolve("circuits/build/eligible_ballot/verification_key.json")
    : resolve(inputDirectory, input.verificationKeyPath),
  "utf8",
)) as unknown;
const storedPackages: StoredEligibleVotePackageV3[] = await Promise.all(
  input.packages.map(async (entry) => {
    if (!entry.contentId.startsWith("ipfs://")) {
      throw new Error(`invalid IPFS content ID: ${entry.contentId}`);
    }
    return {
      contentId: entry.contentId,
      package: await parseEligibleVotePackageJson(
        await readFile(resolve(inputDirectory, entry.path), "utf8"),
      ),
    };
  }),
);
const manifest = await buildEligibleBatchManifest(
  input.electionId,
  input.eligibilityRoot,
  input.previousNullifierRoot,
  storedPackages,
  new NullifierAccumulator(input.knownPreviousNullifiers ?? []),
  verificationKey,
);
const receipts = await Promise.all(storedPackages.map(async (storedPackage) => ({
  contentId: storedPackage.contentId,
  ...await buildEligibleInclusionReceipt(manifest, storedPackage.package),
})));
const artifact = {
  manifest,
  trustedBatchSubmissionArgs: [
    manifest.cidMerkleRoot,
    manifest.previousNullifierRoot,
    manifest.nullifierRoot,
    manifest.manifestDigest,
    manifest.batchSize,
  ],
  recursiveProofSubmissionStatement: {
    batchPublicInputsHash: manifest.batchPublicInputsHash,
    implemented: false,
    reason: "No recursive batch verifier is included; use trusted demo submission only.",
  },
  receipts,
};
await writeFile(resolve(outputPath), `${JSON.stringify(
  artifact,
  (_, value) => typeof value === "bigint" ? value.toString() : value,
  2,
)}\n`);

console.log(JSON.stringify({
  outputPath: resolve(outputPath),
  manifestDigest: manifest.manifestDigest,
  batchPublicInputsHash: manifest.batchPublicInputsHash,
  aggregateCiphertextDigest: manifest.aggregateCiphertextDigest,
  batchSize: manifest.batchSize.toString(),
  verifiedGroth16Proofs: manifest.ballotProofPublicInputsHashes.length,
  verificationMode: manifest.verificationMode,
  recursiveBatchProofImplemented: false,
}, null, 2));
