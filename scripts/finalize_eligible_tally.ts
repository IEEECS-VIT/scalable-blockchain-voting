import { dirname, resolve } from "node:path";
import { readFile, writeFile } from "node:fs/promises";

import { encodeAbiParameters, keccak256, parseAbiParameters, stringToHex } from "viem";

import type { Bytes32 } from "../packages/crypto/src/index.js";
import {
  digestProofCompatibleCiphertext,
  type ProofCompatibleCiphertextJson,
  type ProofCompatiblePointJson,
} from "../packages/crypto/src/proofCompatiblePipeline.js";
import {
  decryptProofCompatibleTallyWithShares,
  digestProofCompatibleDecryptionShare,
  verifyProofCompatibleDecryptionShare,
  type ProofCompatibleDecryptionShare,
} from "../packages/crypto/src/proofCompatibleThreshold.js";

type EncryptedTally = {
  electionId: Bytes32;
  candidateListHash: Bytes32;
  eligibilityRoot: Bytes32;
  ballotCount: number;
  aggregateCiphertext: ProofCompatibleCiphertextJson;
  aggregateCiphertextDigest: Bytes32;
  acceptedBatchManifestDigests: readonly Bytes32[];
  acceptedBatchPublicInputsHashes: readonly Bytes32[];
  encryptedTallyPublicInputsHash: Bytes32;
};
type PublicKeyset = {
  ceremonyModel: string;
  threshold: number;
  trusteeCount: number;
  publicKeyHash: Bytes32;
  transcriptDigest: Bytes32;
  trusteePublicShares: readonly {
    trusteeIndex: number;
    publicShare: ProofCompatiblePointJson;
  }[];
};
type PublicShareArtifact = {
  ceremonyTranscriptDigest: Bytes32;
  encryptedTallyPublicInputsHash: Bytes32;
  share: ProofCompatibleDecryptionShare;
  shareDigest: Bytes32;
};
type FinalizeInput = {
  encryptedTallyPath: string;
  publicKeysetPath: string;
  decryptionShares: readonly { path: string }[];
  maxVotes?: number;
};

const inputPath = process.argv[2];
const outputPath = process.argv[3];
if (inputPath === undefined || outputPath === undefined) {
  throw new Error("usage: npm run finalize:tally:v3 -- finalize-input.json tally-result-v3.json");
}
const resolvedInputPath = resolve(inputPath);
const inputDirectory = dirname(resolvedInputPath);
const input = JSON.parse(await readFile(resolvedInputPath, "utf8")) as FinalizeInput;
const encryptedTally = JSON.parse(await readFile(
  resolve(inputDirectory, input.encryptedTallyPath), "utf8",
)) as EncryptedTally;
const keyset = JSON.parse(await readFile(
  resolve(inputDirectory, input.publicKeysetPath), "utf8",
)) as PublicKeyset;
if (keyset.publicKeyHash !== encryptedTally.aggregateCiphertext.electionPublicKeyHash) {
  throw new Error("threshold keyset does not match encrypted tally");
}
if (input.decryptionShares.length < keyset.threshold) {
  throw new Error("not enough independently generated decryption shares");
}
const shareArtifacts = await Promise.all(input.decryptionShares.map(async (entry) =>
  JSON.parse(await readFile(resolve(inputDirectory, entry.path), "utf8")) as PublicShareArtifact
));
const selected = shareArtifacts.slice(0, keyset.threshold);
if (new Set(selected.map((artifact) => artifact.share.trusteeIndex)).size !== selected.length) {
  throw new Error("duplicate trustee index");
}
for (const artifact of selected) {
  if (
    artifact.ceremonyTranscriptDigest !== keyset.transcriptDigest ||
    artifact.encryptedTallyPublicInputsHash !== encryptedTally.encryptedTallyPublicInputsHash
  ) throw new Error("trustee share is bound to another ceremony or tally");
  const expectedPublicShare = keyset.trusteePublicShares.find(
    (entry) => entry.trusteeIndex === artifact.share.trusteeIndex,
  );
  if (expectedPublicShare === undefined ||
      JSON.stringify(expectedPublicShare.publicShare) !== JSON.stringify(artifact.share.trusteePublicShare)) {
    throw new Error(`unknown public share for trustee ${artifact.share.trusteeIndex}`);
  }
  if (digestProofCompatibleDecryptionShare(artifact.share) !== artifact.shareDigest) {
    throw new Error(`share digest mismatch for trustee ${artifact.share.trusteeIndex}`);
  }
  if (!await verifyProofCompatibleDecryptionShare({
    ciphertext: encryptedTally.aggregateCiphertext,
    share: artifact.share,
  })) throw new Error(`DLEQ proof rejected for trustee ${artifact.share.trusteeIndex}`);
}
const shares = selected.map((artifact) => artifact.share);
const tallyCounts = await decryptProofCompatibleTallyWithShares({
  ciphertext: encryptedTally.aggregateCiphertext,
  shares,
  threshold: keyset.threshold,
  maxVotes: input.maxVotes ?? encryptedTally.ballotCount,
});
const aggregateCiphertextDigest = digestProofCompatibleCiphertext(
  encryptedTally.aggregateCiphertext,
);
if (aggregateCiphertextDigest !== encryptedTally.aggregateCiphertextDigest) {
  throw new Error("encrypted tally ciphertext digest mismatch");
}
const decryptionShareDigests = shares.map(digestProofCompatibleDecryptionShare);
const domainHash = (domain: string) => keccak256(stringToHex(domain));
const resultHash = keccak256(encodeAbiParameters(
  parseAbiParameters(
    "bytes32 domain, bytes32 electionId, bytes32 candidateListHash, bytes32 eligibilityRoot, bytes32 encryptedTallyPublicInputsHash, bytes32 aggregateCiphertextDigest, uint32[] tallyCounts, bytes32[] decryptionShareDigests, bytes32 ceremonyTranscriptDigest",
  ),
  [
    domainHash("SVB_ELIGIBLE_TALLY_RESULT_V3"),
    encryptedTally.electionId,
    encryptedTally.candidateListHash,
    encryptedTally.eligibilityRoot,
    encryptedTally.encryptedTallyPublicInputsHash,
    aggregateCiphertextDigest,
    [...tallyCounts],
    decryptionShareDigests,
    keyset.transcriptDigest,
  ],
));
const tallyProofPublicInputsHash = keccak256(encodeAbiParameters(
  parseAbiParameters(
    "bytes32 domain, bytes32 electionId, bytes32 candidateListHash, bytes32 eligibilityRoot, bytes32[] acceptedBatchManifestDigests, bytes32[] acceptedBatchPublicInputsHashes, bytes32 aggregateCiphertextDigest, uint32[] tallyCounts, bytes32[] decryptionShareDigests, bytes32 ceremonyTranscriptDigest, bytes32 resultHash",
  ),
  [
    domainHash("SVB_ELIGIBLE_TALLY_PUBLIC_INPUTS_V3"),
    encryptedTally.electionId,
    encryptedTally.candidateListHash,
    encryptedTally.eligibilityRoot,
    encryptedTally.acceptedBatchManifestDigests,
    encryptedTally.acceptedBatchPublicInputsHashes,
    aggregateCiphertextDigest,
    [...tallyCounts],
    decryptionShareDigests,
    keyset.transcriptDigest,
    resultHash,
  ],
));
const artifact = {
  version: 3,
  scheme: `threshold-babyjubjub-elgamal-${keyset.threshold}-of-${keyset.trusteeCount}-v1`,
  ceremonyModel: keyset.ceremonyModel,
  electionId: encryptedTally.electionId,
  candidateListHash: encryptedTally.candidateListHash,
  eligibilityRoot: encryptedTally.eligibilityRoot,
  ballotCount: encryptedTally.ballotCount,
  threshold: keyset.threshold,
  trusteeCount: keyset.trusteeCount,
  aggregateCiphertextDigest,
  encryptedTallyPublicInputsHash: encryptedTally.encryptedTallyPublicInputsHash,
  tallyCounts,
  decryptionShareDigests,
  ceremonyTranscriptDigest: keyset.transcriptDigest,
  resultHash,
  tallyProofPublicInputsHash,
  verificationStatus: "threshold-dleq-verified-off-chain",
  onchainTallyProofImplemented: false,
};
await writeFile(resolve(outputPath), `${JSON.stringify(artifact, null, 2)}\n`);
console.log(JSON.stringify({
  outputPath: resolve(outputPath),
  tallyCounts,
  resultHash,
  tallyProofPublicInputsHash,
  acceptedIndependentShares: shares.length,
  verificationStatus: artifact.verificationStatus,
  onchainTallyProofImplemented: false,
}, null, 2));
