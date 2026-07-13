import { dirname, resolve } from "node:path";
import { readFile, writeFile } from "node:fs/promises";

import {
  NullifierAccumulator,
  type Bytes32,
} from "../packages/crypto/src/index.js";
import {
  aggregateProofCompatibleCiphertexts,
  buildProofCompatibleBatchManifest,
  computeProofCompatibleEncryptedTallyHash,
  decryptProofCompatibleTally,
  digestProofCompatibleCiphertext,
  parseProofCompatibleVotePackageJson,
  type ProofCompatibleBatchManifestV2,
  type StoredProofCompatibleVotePackageV2,
} from "../packages/crypto/src/proofCompatiblePipeline.js";

type TallyInput = {
  electionId: Bytes32;
  candidateListHash: Bytes32;
  knownPreviousNullifiers?: readonly Bytes32[];
  privateKey?: string;
  maxVotes?: number;
  acceptedBatches: readonly {
    batchArtifactPath: string;
    packages: readonly { contentId: string; path: string }[];
  }[];
};

type StoredBatchArtifact = {
  manifest: Omit<ProofCompatibleBatchManifestV2, "batchSize"> & {
    batchSize: string;
  };
};

const inputPath = process.argv[2];
const outputPath = process.argv[3];
if (inputPath === undefined || outputPath === undefined) {
  throw new Error(
    "usage: npm run build:tally:v2 -- tally-input.json encrypted-tally-v2.json",
  );
}

const resolvedInputPath = resolve(inputPath);
const inputDirectory = dirname(resolvedInputPath);
const input = JSON.parse(await readFile(resolvedInputPath, "utf8")) as TallyInput;
if (input.acceptedBatches.length === 0) {
  throw new Error("tally input must include at least one accepted batch");
}

const accumulator = new NullifierAccumulator(input.knownPreviousNullifiers ?? []);
const manifests: ProofCompatibleBatchManifestV2[] = [];
let ballotCount = 0;
for (const batch of input.acceptedBatches) {
  const storedArtifact = JSON.parse(
    await readFile(resolve(inputDirectory, batch.batchArtifactPath), "utf8"),
  ) as StoredBatchArtifact;
  const storedPackages: StoredProofCompatibleVotePackageV2[] = await Promise.all(
    batch.packages.map(async (entry) => ({
      contentId: entry.contentId,
      package: await parseProofCompatibleVotePackageJson(
        await readFile(resolve(inputDirectory, entry.path), "utf8"),
      ),
    })),
  );
  for (const storedPackage of storedPackages) {
    if (storedPackage.package.candidateListHash !== input.candidateListHash.toLowerCase()) {
      throw new Error("candidate-list hash mismatch");
    }
  }
  const manifest = await buildProofCompatibleBatchManifest(
    input.electionId,
    storedArtifact.manifest.previousNullifierRoot,
    storedPackages,
    accumulator,
  );
  for (const field of [
    "manifestDigest",
    "batchPublicInputsHash",
    "aggregateCiphertextDigest",
    "nullifierRoot",
    "cidMerkleRoot",
  ] as const) {
    if (manifest[field] !== storedArtifact.manifest[field]) {
      throw new Error(`accepted batch artifact mismatch for ${field}`);
    }
  }
  manifests.push(manifest);
  ballotCount += storedPackages.length;
}

const aggregateCiphertext = await aggregateProofCompatibleCiphertexts(
  manifests.map((manifest) => manifest.aggregateCiphertext),
);
const acceptedBatchManifestDigests = manifests.map(
  (manifest) => manifest.manifestDigest,
);
const acceptedBatchPublicInputsHashes = manifests.map(
  (manifest) => manifest.batchPublicInputsHash,
);
const artifact = {
  version: 2,
  electionId: input.electionId.toLowerCase(),
  candidateListHash: input.candidateListHash.toLowerCase(),
  ballotCount,
  aggregateCiphertext,
  aggregateCiphertextDigest: digestProofCompatibleCiphertext(aggregateCiphertext),
  acceptedBatchManifestDigests,
  acceptedBatchPublicInputsHashes,
  encryptedTallyPublicInputsHash: computeProofCompatibleEncryptedTallyHash({
    electionId: input.electionId,
    candidateListHash: input.candidateListHash,
    acceptedBatchManifestDigests,
    acceptedBatchPublicInputsHashes,
    aggregateCiphertext,
  }),
  tallyCounts: input.privateKey === undefined
    ? undefined
    : await decryptProofCompatibleTally({
        privateKey: BigInt(input.privateKey),
        ciphertext: aggregateCiphertext,
        maxVotes: input.maxVotes ?? ballotCount,
      }),
};
await writeFile(resolve(outputPath), `${JSON.stringify(artifact, null, 2)}\n`);

console.log(JSON.stringify({
  outputPath: resolve(outputPath),
  ballotCount,
  aggregateCiphertextDigest: artifact.aggregateCiphertextDigest,
  encryptedTallyPublicInputsHash: artifact.encryptedTallyPublicInputsHash,
  tallyCounts: artifact.tallyCounts,
}, null, 2));
