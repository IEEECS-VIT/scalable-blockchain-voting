import { dirname, resolve } from "node:path";
import { readFile, writeFile } from "node:fs/promises";

import {
  NullifierAccumulator,
  type Bytes32,
} from "../packages/crypto/src/index.js";
import {
  buildProofCompatibleBatchManifest,
  buildProofCompatibleInclusionReceipt,
  parseProofCompatibleVotePackageJson,
  type StoredProofCompatibleVotePackageV2,
} from "../packages/crypto/src/proofCompatiblePipeline.js";

type BatchInput = {
  electionId: Bytes32;
  previousNullifierRoot: Bytes32;
  knownPreviousNullifiers?: readonly Bytes32[];
  packages: readonly { contentId: string; path: string }[];
};

const inputPath = process.argv[2];
const outputPath = process.argv[3];
if (inputPath === undefined || outputPath === undefined) {
  throw new Error(
    "usage: npm run build:batch:v2 -- batch-input.json batch-artifact-v2.json",
  );
}

const resolvedInputPath = resolve(inputPath);
const inputDirectory = dirname(resolvedInputPath);
const input = JSON.parse(await readFile(resolvedInputPath, "utf8")) as BatchInput;
if (!Array.isArray(input.packages) || input.packages.length === 0) {
  throw new Error("batch input must include proof-compatible packages");
}
const storedPackages: StoredProofCompatibleVotePackageV2[] = await Promise.all(
  input.packages.map(async (entry) => {
    if (!entry.contentId.startsWith("ipfs://")) {
      throw new Error(`invalid IPFS content ID: ${entry.contentId}`);
    }
    return {
      contentId: entry.contentId,
      package: await parseProofCompatibleVotePackageJson(
        await readFile(resolve(inputDirectory, entry.path), "utf8"),
      ),
    };
  }),
);
const manifest = await buildProofCompatibleBatchManifest(
  input.electionId,
  input.previousNullifierRoot,
  storedPackages,
  new NullifierAccumulator(input.knownPreviousNullifiers ?? []),
);
const receipts = await Promise.all(
  storedPackages.map(async (storedPackage) => ({
    contentId: storedPackage.contentId,
    ...await buildProofCompatibleInclusionReceipt(manifest, storedPackage.package),
  })),
);
const artifact = {
  manifest,
  submitBatchArgs: [
    manifest.cidMerkleRoot,
    manifest.previousNullifierRoot,
    manifest.nullifierRoot,
    manifest.manifestDigest,
    manifest.batchSize,
  ],
  submitBatchWithProofArgsPrefix: [
    manifest.cidMerkleRoot,
    manifest.previousNullifierRoot,
    manifest.nullifierRoot,
    manifest.manifestDigest,
    manifest.batchPublicInputsHash,
    manifest.batchSize,
  ],
  receipts,
};
await writeFile(
  resolve(outputPath),
  `${JSON.stringify(artifact, (_, value) =>
    typeof value === "bigint" ? value.toString() : value, 2)}\n`,
);

console.log(JSON.stringify({
  outputPath: resolve(outputPath),
  manifestDigest: manifest.manifestDigest,
  batchPublicInputsHash: manifest.batchPublicInputsHash,
  aggregateCiphertextDigest: manifest.aggregateCiphertextDigest,
  batchSize: manifest.batchSize.toString(),
}, null, 2));
