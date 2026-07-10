import { dirname, resolve } from "node:path";
import { readFile } from "node:fs/promises";

import {
  NullifierAccumulator,
  buildBatchManifest,
  buildInclusionReceipt,
  digestVotePackage,
  parseVotePackageJson,
  type Bytes32,
  type StoredVotePackageV1,
} from "../packages/crypto/src/index.js";

type BatchInputPackage = {
  contentId: string;
  path: string;
};

type BatchInput = {
  electionId: Bytes32;
  previousNullifierRoot: Bytes32;
  knownPreviousNullifiers?: readonly Bytes32[];
  packages: readonly BatchInputPackage[];
};

function usage(): never {
  throw new Error(
    "Usage: npm run build:batch -- <batch-input.json>",
  );
}

function jsonReplacer(_key: string, value: unknown) {
  return typeof value === "bigint" ? value.toString() : value;
}

function validateContentId(contentId: string) {
  if (!contentId.startsWith("ipfs://") || contentId.length <= "ipfs://".length) {
    throw new Error(`invalid IPFS content ID: ${contentId}`);
  }
}

async function loadBatchInput(inputPath: string): Promise<{
  batchInput: BatchInput;
  storedPackages: StoredVotePackageV1[];
}> {
  const inputJson = await readFile(inputPath, "utf8");
  const batchInput = JSON.parse(inputJson) as BatchInput;
  if (!Array.isArray(batchInput.packages) || batchInput.packages.length === 0) {
    throw new Error("batch input must include at least one package");
  }

  const inputDir = dirname(inputPath);
  const storedPackages = await Promise.all(
    batchInput.packages.map(async (entry) => {
      validateContentId(entry.contentId);
      const packageJson = await readFile(resolve(inputDir, entry.path), "utf8");
      const votePackage = parseVotePackageJson(packageJson);
      if (votePackage.electionId !== batchInput.electionId.toLowerCase()) {
        throw new Error(`package ${entry.path} electionId does not match batch input`);
      }
      return {
        contentId: entry.contentId,
        package: votePackage,
      };
    }),
  );

  return { batchInput, storedPackages };
}

async function main() {
  const inputPath = process.argv[2] ?? usage();
  const { batchInput, storedPackages } = await loadBatchInput(inputPath);
  const accumulator = new NullifierAccumulator(
    batchInput.knownPreviousNullifiers ?? [],
  );
  const manifest = buildBatchManifest(
    batchInput.electionId,
    batchInput.previousNullifierRoot,
    storedPackages,
    accumulator,
  );
  const receipts = storedPackages.map((storedPackage) => {
    const packageDigest = digestVotePackage(storedPackage.package);
    return {
      contentId: storedPackage.contentId,
      ...buildInclusionReceipt(manifest, packageDigest),
    };
  });

  console.log(JSON.stringify({
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
  }, jsonReplacer, 2));
}

await main();
