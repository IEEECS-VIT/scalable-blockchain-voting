import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { encodeFunctionData, keccak256, stringToHex } from "viem";

import {
  BALLOT_PROOF_SYSTEM,
  NullifierAccumulator,
  VOTE_PACKAGE_VERSION,
  aggregateBallotCiphertexts,
  buildBatchManifest,
  buildInclusionReceipt,
  computeBallotPublicInputsHash,
  computeEncryptedTallyPublicInputsHash,
  computeRegistrationPublicInputsHash,
  computeTallyProofPublicInputsHash,
  computeTallyResultHash,
  createTallyDecryptionShare,
  createThresholdElectionKeyShares,
  decryptAggregatedTallyWithShares,
  digestBallotCiphertext,
  digestTallyDecryptionShare,
  digestVotePackage,
  encryptBallotSelection,
  serializeVotePackage,
  type Address,
  type Bytes32,
  type Hex,
  type StoredVotePackageV1,
  type VotePackageV1,
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

const demoPrivateKey =
  "0x0000000000000000000000000000000000000000000000000000000000000007" as Hex;
const registryAddress = "0x1111111111111111111111111111111111111111" as Address;
const votingKey = "0x2222222222222222222222222222222222222222" as Address;
const proof = "0x1234" as Hex;
const selectedVotes = [0, 2, 1] as const;

function usage(): never {
  throw new Error("Usage: npm run demo:fixture -- <output-directory>");
}

function jsonReplacer(_key: string, value: unknown) {
  return typeof value === "bigint" ? value.toString() : value;
}

function hash(value: string): Bytes32 {
  return keccak256(stringToHex(value));
}

function scalar(value: bigint): Hex {
  return `0x${value.toString(16).padStart(64, "0")}`;
}

async function writeJson(outputDir: string, name: string, value: unknown) {
  await writeFile(
    join(outputDir, name),
    `${JSON.stringify(value, jsonReplacer, 2)}\n`,
    "utf8",
  );
}

function votePackage(params: {
  electionId: Bytes32;
  candidateListHash: Bytes32;
  electionPublicKey: Hex;
  label: string;
  selectedIndex: number;
}): VotePackageV1 {
  const labelCode = BigInt(params.label.charCodeAt(0));
  const ballotNullifier = hash(`demo-ballot-nullifier-${params.label}`);
  const ciphertext = encryptBallotSelection({
    electionPublicKey: params.electionPublicKey,
    candidateCount: 3,
    selectedIndex: params.selectedIndex,
    randomness: [
      scalar(100n + labelCode),
      scalar(200n + labelCode),
      scalar(300n + labelCode),
    ],
  });

  return {
    version: VOTE_PACKAGE_VERSION,
    electionId: params.electionId,
    candidateListHash: params.candidateListHash,
    ballotNullifier,
    ciphertext,
    ballotValidityProof: {
      system: BALLOT_PROOF_SYSTEM,
      proof,
      publicInputsHash: computeBallotPublicInputsHash({
        electionId: params.electionId,
        candidateListHash: params.candidateListHash,
        ballotNullifier,
        ciphertext,
      }),
    },
  };
}

async function main() {
  const outputDir = resolve(process.argv[2] ?? usage());
  await mkdir(outputDir, { recursive: true });

  const electionId = hash("demo-fixture-election");
  const candidateListHash = hash("alice,bob,carol");
  const identityNullifier = hash("demo-fixture-identity-nullifier");
  const thresholdKey = createThresholdElectionKeyShares({
    privateKey: demoPrivateKey,
    threshold: 2,
    trusteeCount: 3,
    coefficients: [
      "0x000000000000000000000000000000000000000000000000000000000000001d",
    ],
  });
  const registrationPublicInputsHash = computeRegistrationPublicInputsHash({
    electionId,
    identityNullifier,
    votingKey,
  });
  const registrationCalldata = encodeFunctionData({
    abi: voterRegistryAbi,
    functionName: "registerWithProof",
    args: [identityNullifier, votingKey as Address, proof],
  });
  const packages = selectedVotes.map((selectedIndex, index) => ({
    contentId: `ipfs://demo-vote-${index + 1}`,
    fileName: `vote-${index + 1}.json`,
    package: votePackage({
      electionId,
      candidateListHash,
      electionPublicKey: thresholdKey.publicKey,
      label: String.fromCharCode(97 + index),
      selectedIndex,
    }),
  }));
  const storedPackages: StoredVotePackageV1[] = packages.map((entry) => ({
    contentId: entry.contentId,
    package: entry.package,
  }));
  const manifest = buildBatchManifest(
    electionId,
    "0x0000000000000000000000000000000000000000000000000000000000000000",
    storedPackages,
    new NullifierAccumulator(),
  );
  const receipts = storedPackages.map((storedPackage) => ({
    contentId: storedPackage.contentId,
    ...buildInclusionReceipt(
      manifest,
      digestVotePackage(storedPackage.package),
    ),
  }));
  const aggregateCiphertext = aggregateBallotCiphertexts(
    storedPackages.map((storedPackage) => storedPackage.package.ciphertext),
  );
  const aggregateCiphertextDigest = digestBallotCiphertext(aggregateCiphertext);
  const encryptedTallyPublicInputsHash = computeEncryptedTallyPublicInputsHash({
    electionId,
    candidateListHash,
    electionPublicKeyHash: aggregateCiphertext.electionPublicKeyHash,
    acceptedBatchPublicInputsHashes: [manifest.batchPublicInputsHash],
    aggregateCiphertext,
  });
  const decryptionShares = thresholdKey.shares.slice(0, 2).map((share, index) =>
    createTallyDecryptionShare({
      trusteeIndex: share.trusteeIndex,
      privateShare: share.privateShare,
      ciphertext: aggregateCiphertext,
      proofNonces: [
        scalar(400n + BigInt(index)),
        scalar(500n + BigInt(index)),
        scalar(600n + BigInt(index)),
      ],
    }),
  );
  const tallyCounts = decryptAggregatedTallyWithShares({
    ciphertext: aggregateCiphertext,
    shares: decryptionShares,
    threshold: 2,
    maxVotes: selectedVotes.length,
  });
  const decryptionShareDigests = decryptionShares.map((share) =>
    digestTallyDecryptionShare({
      ciphertext: aggregateCiphertext,
      share,
    }),
  );
  const resultHash = computeTallyResultHash({
    electionId,
    candidateListHash,
    electionPublicKeyHash: thresholdKey.publicKeyHash,
    aggregateCiphertext,
    tallyCounts,
    decryptionShareDigests,
  });
  const tallyProofPublicInputsHash = computeTallyProofPublicInputsHash({
    electionId,
    candidateListHash,
    electionPublicKeyHash: thresholdKey.publicKeyHash,
    acceptedBatchManifestDigests: [manifest.manifestDigest],
    acceptedBatchPublicInputsHashes: [manifest.batchPublicInputsHash],
    aggregateCiphertext,
    tallyCounts,
    decryptionShareDigests,
    resultHash,
  });

  await writeJson(outputDir, "election.json", {
    electionId,
    candidateListHash,
    candidates: ["Alice", "Bob", "Carol"],
    threshold: thresholdKey.threshold,
    trusteeCount: thresholdKey.trusteeCount,
    electionPublicKey: thresholdKey.publicKey,
    electionPublicKeyHash: thresholdKey.publicKeyHash,
    trusteePublicShares: thresholdKey.shares.map((share) => ({
      trusteeIndex: share.trusteeIndex,
      publicShare: share.publicShare,
    })),
    demoOnlySecrets: {
      electionPrivateKey: demoPrivateKey,
      trusteePrivateShares: thresholdKey.shares.map((share) => ({
        trusteeIndex: share.trusteeIndex,
        privateShare: share.privateShare,
      })),
    },
  });
  await writeJson(outputDir, "registration-request-input.json", {
    electionId,
    registryAddress,
    identityNullifier,
    votingKey,
    proof,
  });
  await writeJson(outputDir, "registration-request-artifact.json", {
    registryAddress,
    method: "registerWithProof",
    identityNullifier,
    votingKey,
    publicInputsHash: registrationPublicInputsHash,
    relayerTransaction: {
      to: registryAddress,
      value: "0",
      data: registrationCalldata,
    },
    registerWithProofArgs: [identityNullifier, votingKey, proof],
  });
  await Promise.all(packages.map((entry) =>
    writeFile(
      join(outputDir, entry.fileName),
      serializeVotePackage(entry.package),
      "utf8",
    ),
  ));
  await writeJson(outputDir, "batch-input.json", {
    electionId,
    previousNullifierRoot: manifest.previousNullifierRoot,
    packages: packages.map((entry) => ({
      contentId: entry.contentId,
      path: entry.fileName,
    })),
  });
  await writeJson(outputDir, "batch-artifact.json", {
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
  });
  await writeJson(outputDir, "tally-input.json", {
    electionId,
    candidateListHash,
    acceptedBatches: [{
      batchArtifactPath: "batch-artifact.json",
      packages: packages.map((entry) => ({
        contentId: entry.contentId,
        path: entry.fileName,
      })),
    }],
  });
  await writeJson(outputDir, "tally-artifact.json", {
    electionId,
    candidateListHash,
    ballotCount: selectedVotes.length,
    aggregateCiphertext,
    aggregateCiphertextDigest,
    acceptedBatchManifestDigests: [manifest.manifestDigest],
    acceptedBatchPublicInputsHashes: [manifest.batchPublicInputsHash],
    encryptedTallyPublicInputsHash,
  });
  await Promise.all(decryptionShares.map((share) =>
    writeJson(outputDir, `decryption-share-${share.trusteeIndex}.json`, share),
  ));
  await writeJson(outputDir, "tally-result-input.json", {
    tallyArtifactPath: "tally-artifact.json",
    threshold: 2,
    decryptionShares: decryptionShares.map((share) => ({
      path: `decryption-share-${share.trusteeIndex}.json`,
    })),
  });
  await writeJson(outputDir, "tally-result-artifact.json", {
    electionId,
    candidateListHash,
    electionPublicKeyHash: thresholdKey.publicKeyHash,
    ballotCount: selectedVotes.length,
    threshold: 2,
    tallyCounts,
    aggregateCiphertextDigest,
    acceptedBatchManifestDigests: [manifest.manifestDigest],
    acceptedBatchPublicInputsHashes: [manifest.batchPublicInputsHash],
    encryptedTallyPublicInputsHash,
    decryptionShareDigests,
    resultHash,
    tallyProofPublicInputsHash,
    tallyVerifierPublishArgs: {
      resultHash,
      publicInputsHash: tallyProofPublicInputsHash,
    },
  });
  await writeJson(outputDir, "README.json", {
    generatedBy: "scripts/generate_demo_fixture.ts",
    warning: "Local deterministic demo fixture only. Proof bytes are placeholders; this is not a SNARK proof.",
    expectedTallyCounts: tallyCounts,
    files: [
      "election.json",
      "registration-request-input.json",
      "registration-request-artifact.json",
      ...packages.map((entry) => entry.fileName),
      "batch-input.json",
      "batch-artifact.json",
      "tally-input.json",
      "tally-artifact.json",
      ...decryptionShares.map((share) => `decryption-share-${share.trusteeIndex}.json`),
      "tally-result-input.json",
      "tally-result-artifact.json",
    ],
  });

  console.log(JSON.stringify({
    outputDir,
    electionId,
    ballotCount: selectedVotes.length,
    tallyCounts,
    batchPublicInputsHash: manifest.batchPublicInputsHash,
    encryptedTallyPublicInputsHash,
    tallyProofPublicInputsHash,
    resultHash,
  }, jsonReplacer, 2));
}

await main();
