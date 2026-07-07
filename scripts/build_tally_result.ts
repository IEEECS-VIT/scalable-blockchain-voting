import { dirname, resolve } from "node:path";
import { readFile } from "node:fs/promises";

import {
  computeTallyProofPublicInputsHash,
  computeTallyResultHash,
  decryptAggregatedTallyWithShares,
  digestBallotCiphertext,
  digestTallyDecryptionShare,
  type BallotCiphertextV1,
  type Bytes32,
  type TallyDecryptionShareV1,
} from "../packages/crypto/src/index.js";

type TallyInputArtifact = {
  electionId: Bytes32;
  candidateListHash: Bytes32;
  ballotCount: number;
  aggregateCiphertext: BallotCiphertextV1;
  aggregateCiphertextDigest: Bytes32;
  acceptedBatchManifestDigests: readonly Bytes32[];
  acceptedBatchPublicInputsHashes: readonly Bytes32[];
  encryptedTallyPublicInputsHash: Bytes32;
};

type TallyResultInput = {
  tallyArtifactPath: string;
  threshold: number;
  maxVotes?: number;
  decryptionShares: readonly {
    path: string;
  }[];
};

function usage(): never {
  throw new Error("Usage: npm run build:tally-result -- <tally-result-input.json>");
}

async function main() {
  const inputPath = process.argv[2] ?? usage();
  const inputDir = dirname(inputPath);
  const input = JSON.parse(await readFile(inputPath, "utf8")) as TallyResultInput;
  const tallyArtifact = JSON.parse(
    await readFile(resolve(inputDir, input.tallyArtifactPath), "utf8"),
  ) as TallyInputArtifact;
  if (!Array.isArray(input.decryptionShares) || input.decryptionShares.length === 0) {
    throw new Error("tally result input must include decryption shares");
  }

  const decryptionShares = await Promise.all(input.decryptionShares.map(async (entry) =>
    JSON.parse(
      await readFile(resolve(inputDir, entry.path), "utf8"),
    ) as TallyDecryptionShareV1,
  ));
  const aggregateCiphertextDigest = digestBallotCiphertext(
    tallyArtifact.aggregateCiphertext,
  );
  if (aggregateCiphertextDigest !== tallyArtifact.aggregateCiphertextDigest.toLowerCase()) {
    throw new Error("aggregate ciphertext digest does not match tally artifact");
  }

  const tallyCounts = decryptAggregatedTallyWithShares({
    ciphertext: tallyArtifact.aggregateCiphertext,
    shares: decryptionShares,
    threshold: input.threshold,
    maxVotes: input.maxVotes ?? tallyArtifact.ballotCount,
  });
  const decryptionShareDigests = decryptionShares.map((share) =>
    digestTallyDecryptionShare({
      ciphertext: tallyArtifact.aggregateCiphertext,
      share,
    }),
  );
  const resultHash = computeTallyResultHash({
    electionId: tallyArtifact.electionId,
    candidateListHash: tallyArtifact.candidateListHash,
    electionPublicKeyHash: tallyArtifact.aggregateCiphertext.electionPublicKeyHash,
    aggregateCiphertext: tallyArtifact.aggregateCiphertext,
    tallyCounts,
    decryptionShareDigests,
  });
  const tallyProofPublicInputsHash = computeTallyProofPublicInputsHash({
    electionId: tallyArtifact.electionId,
    candidateListHash: tallyArtifact.candidateListHash,
    electionPublicKeyHash: tallyArtifact.aggregateCiphertext.electionPublicKeyHash,
    acceptedBatchManifestDigests: tallyArtifact.acceptedBatchManifestDigests,
    acceptedBatchPublicInputsHashes: tallyArtifact.acceptedBatchPublicInputsHashes,
    aggregateCiphertext: tallyArtifact.aggregateCiphertext,
    tallyCounts,
    decryptionShareDigests,
    resultHash,
  });

  console.log(JSON.stringify({
    electionId: tallyArtifact.electionId.toLowerCase(),
    candidateListHash: tallyArtifact.candidateListHash.toLowerCase(),
    electionPublicKeyHash: tallyArtifact.aggregateCiphertext.electionPublicKeyHash,
    ballotCount: tallyArtifact.ballotCount,
    threshold: input.threshold,
    tallyCounts,
    aggregateCiphertextDigest,
    acceptedBatchManifestDigests: tallyArtifact.acceptedBatchManifestDigests,
    acceptedBatchPublicInputsHashes: tallyArtifact.acceptedBatchPublicInputsHashes,
    encryptedTallyPublicInputsHash: tallyArtifact.encryptedTallyPublicInputsHash,
    decryptionShareDigests,
    resultHash,
    tallyProofPublicInputsHash,
    tallyVerifierPublishArgs: {
      resultHash,
      publicInputsHash: tallyProofPublicInputsHash,
    },
  }, null, 2));
}

await main();
