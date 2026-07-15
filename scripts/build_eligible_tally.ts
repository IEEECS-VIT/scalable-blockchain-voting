import { dirname, resolve } from "node:path";
import { readFile, writeFile } from "node:fs/promises";

import { NullifierAccumulator, type Bytes32 } from "../packages/crypto/src/index.js";
import {
  aggregateProofCompatibleCiphertexts,
  digestProofCompatibleCiphertext,
} from "../packages/crypto/src/proofCompatiblePipeline.js";
import {
  buildEligibleBatchManifest,
  computeEligibleEncryptedTallyHash,
  parseEligibleVotePackageJson,
  type EligibleBatchManifestV3,
  type StoredEligibleVotePackageV3,
} from "../packages/crypto/src/eligiblePipeline.js";

type TallyInput = {
  electionId: Bytes32;
  candidateListHash: Bytes32;
  eligibilityRoot: Bytes32;
  verificationKeyPath?: string;
  knownPreviousNullifiers?: readonly Bytes32[];
  acceptedBatches: readonly {
    batchArtifactPath: string;
    packages: readonly { contentId: string; path: string }[];
  }[];
};

type StoredBatchArtifact = {
  manifest: Omit<EligibleBatchManifestV3, "batchSize"> & { batchSize: string };
};

const inputPath = process.argv[2];
const outputPath = process.argv[3];
if (inputPath === undefined || outputPath === undefined) {
  throw new Error("usage: npm run build:tally:v3 -- tally-input.json encrypted-tally-v3.json");
}
const resolvedInputPath = resolve(inputPath);
const inputDirectory = dirname(resolvedInputPath);
const input = JSON.parse(await readFile(resolvedInputPath, "utf8")) as TallyInput;
if (!Array.isArray(input.acceptedBatches) || input.acceptedBatches.length === 0) {
  throw new Error("tally input must include at least one accepted V3 batch");
}
const verificationKey = JSON.parse(await readFile(
  input.verificationKeyPath === undefined
    ? resolve("circuits/build/eligible_ballot/verification_key.json")
    : resolve(inputDirectory, input.verificationKeyPath),
  "utf8",
)) as unknown;

const accumulator = new NullifierAccumulator(input.knownPreviousNullifiers ?? []);
const manifests: EligibleBatchManifestV3[] = [];
let ballotCount = 0;
for (const batch of input.acceptedBatches) {
  const storedArtifact = JSON.parse(await readFile(
    resolve(inputDirectory, batch.batchArtifactPath), "utf8",
  )) as StoredBatchArtifact;
  const storedPackages: StoredEligibleVotePackageV3[] = await Promise.all(
    batch.packages.map(async (entry: { contentId: string; path: string }) => ({
      contentId: entry.contentId,
      package: await parseEligibleVotePackageJson(
        await readFile(resolve(inputDirectory, entry.path), "utf8"),
      ),
    })),
  );
  const manifest = await buildEligibleBatchManifest(
    input.electionId,
    input.eligibilityRoot,
    storedArtifact.manifest.previousNullifierRoot,
    storedPackages,
    accumulator,
    verificationKey,
  );
  if (manifest.candidateListHash !== input.candidateListHash.toLowerCase()) {
    throw new Error("candidate-list hash mismatch");
  }
  for (const field of [
    "manifestDigest",
    "batchPublicInputsHash",
    "aggregateCiphertextDigest",
    "nullifierRoot",
    "cidMerkleRoot",
    "eligibilityRoot",
    "candidateListHash",
    "electionPublicKeyHash",
  ] as const) {
    if (manifest[field] !== storedArtifact.manifest[field]) {
      throw new Error(`accepted V3 batch artifact mismatch for ${field}`);
    }
  }
  manifests.push(manifest);
  ballotCount += storedPackages.length;
}

const aggregateCiphertext = await aggregateProofCompatibleCiphertexts(
  manifests.map((manifest) => manifest.aggregateCiphertext),
);
const acceptedBatchManifestDigests = manifests.map((manifest) => manifest.manifestDigest);
const acceptedBatchPublicInputsHashes = manifests.map(
  (manifest) => manifest.batchPublicInputsHash,
);
const artifact = {
  version: 3,
  electionId: input.electionId.toLowerCase(),
  candidateListHash: input.candidateListHash.toLowerCase(),
  eligibilityRoot: input.eligibilityRoot.toLowerCase(),
  ballotCount,
  aggregateCiphertext,
  aggregateCiphertextDigest: digestProofCompatibleCiphertext(aggregateCiphertext),
  acceptedBatchManifestDigests,
  acceptedBatchPublicInputsHashes,
  encryptedTallyPublicInputsHash: computeEligibleEncryptedTallyHash({
    electionId: input.electionId,
    candidateListHash: input.candidateListHash,
    eligibilityRoot: input.eligibilityRoot,
    acceptedBatchManifestDigests,
    acceptedBatchPublicInputsHashes,
    aggregateCiphertext,
  }),
  decryptionMode: "independent-threshold-dleq-shares-v1",
};
await writeFile(resolve(outputPath), `${JSON.stringify(artifact, null, 2)}\n`);
console.log(JSON.stringify({
  outputPath: resolve(outputPath),
  ballotCount,
  eligibilityRoot: artifact.eligibilityRoot,
  aggregateCiphertextDigest: artifact.aggregateCiphertextDigest,
  encryptedTallyPublicInputsHash: artifact.encryptedTallyPublicInputsHash,
  decryptionMode: artifact.decryptionMode,
}, null, 2));
