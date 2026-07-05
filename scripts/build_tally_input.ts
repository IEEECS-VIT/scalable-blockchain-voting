import { dirname, resolve } from "node:path";
import { readFile } from "node:fs/promises";

import {
  NullifierAccumulator,
  aggregateBallotCiphertexts,
  buildBatchManifest,
  computeEncryptedTallyPublicInputsHash,
  digestBallotCiphertext,
  parseVotePackageJson,
  type BallotCiphertextV1,
  type BatchManifestV1,
  type Bytes32,
  type StoredVotePackageV1,
} from "../packages/crypto/src/index.js";

type TallyInputPackage = {
  contentId: string;
  path: string;
};

type TallyInputBatch = {
  batchArtifactPath: string;
  packages: readonly TallyInputPackage[];
};

type TallyInput = {
  electionId: Bytes32;
  candidateListHash: Bytes32;
  knownPreviousNullifiers?: readonly Bytes32[];
  acceptedBatches: readonly TallyInputBatch[];
};

type BatchArtifact = {
  manifest: Omit<BatchManifestV1, "batchSize"> & { batchSize: string };
};

function usage(): never {
  throw new Error("Usage: npm run build:tally -- <tally-input.json>");
}

async function loadStoredPackages(
  inputDir: string,
  entries: readonly TallyInputPackage[],
): Promise<StoredVotePackageV1[]> {
  return Promise.all(entries.map(async (entry) => {
    const packageJson = await readFile(resolve(inputDir, entry.path), "utf8");
    return {
      contentId: entry.contentId,
      package: parseVotePackageJson(packageJson),
    };
  }));
}

function assertManifestMatchesArtifact(
  manifest: BatchManifestV1,
  artifact: BatchArtifact,
) {
  const expected = artifact.manifest;
  const checks: Array<[string, unknown, unknown]> = [
    ["electionId", manifest.electionId, expected.electionId],
    ["previousNullifierRoot", manifest.previousNullifierRoot, expected.previousNullifierRoot],
    ["nullifierRoot", manifest.nullifierRoot, expected.nullifierRoot],
    ["cidMerkleRoot", manifest.cidMerkleRoot, expected.cidMerkleRoot],
    ["manifestDigest", manifest.manifestDigest, expected.manifestDigest],
    ["batchPublicInputsHash", manifest.batchPublicInputsHash, expected.batchPublicInputsHash],
    ["batchSize", manifest.batchSize.toString(), expected.batchSize],
  ];
  for (const [label, actual, wanted] of checks) {
    if (actual !== wanted) {
      throw new Error(`batch artifact mismatch for ${label}`);
    }
  }
}

async function main() {
  const inputPath = process.argv[2] ?? usage();
  const inputDir = dirname(inputPath);
  const input = JSON.parse(await readFile(inputPath, "utf8")) as TallyInput;
  if (!Array.isArray(input.acceptedBatches) || input.acceptedBatches.length === 0) {
    throw new Error("tally input must include at least one accepted batch");
  }

  const accumulator = new NullifierAccumulator(input.knownPreviousNullifiers ?? []);
  const ciphertexts: BallotCiphertextV1[] = [];
  const acceptedBatchManifestDigests: Bytes32[] = [];
  const acceptedBatchPublicInputsHashes: Bytes32[] = [];

  for (const batch of input.acceptedBatches) {
    const artifact = JSON.parse(
      await readFile(resolve(inputDir, batch.batchArtifactPath), "utf8"),
    ) as BatchArtifact;
    const storedPackages = await loadStoredPackages(inputDir, batch.packages);
    const manifest = buildBatchManifest(
      input.electionId,
      artifact.manifest.previousNullifierRoot,
      storedPackages,
      accumulator,
    );
    assertManifestMatchesArtifact(manifest, artifact);

    for (const storedPackage of storedPackages) {
      if (storedPackage.package.candidateListHash !== input.candidateListHash.toLowerCase()) {
        throw new Error("package candidateListHash does not match tally input");
      }
      ciphertexts.push(storedPackage.package.ciphertext);
    }
    acceptedBatchManifestDigests.push(manifest.manifestDigest);
    acceptedBatchPublicInputsHashes.push(manifest.batchPublicInputsHash);
  }

  const aggregateCiphertext = aggregateBallotCiphertexts(ciphertexts);
  const aggregateCiphertextDigest = digestBallotCiphertext(aggregateCiphertext);
  const encryptedTallyPublicInputsHash = computeEncryptedTallyPublicInputsHash({
    electionId: input.electionId,
    candidateListHash: input.candidateListHash,
    electionPublicKeyHash: aggregateCiphertext.electionPublicKeyHash,
    acceptedBatchPublicInputsHashes,
    aggregateCiphertext,
  });

  console.log(JSON.stringify({
    electionId: input.electionId.toLowerCase(),
    candidateListHash: input.candidateListHash.toLowerCase(),
    ballotCount: ciphertexts.length,
    aggregateCiphertext,
    aggregateCiphertextDigest,
    acceptedBatchManifestDigests,
    acceptedBatchPublicInputsHashes,
    encryptedTallyPublicInputsHash,
  }, null, 2));
}

await main();
