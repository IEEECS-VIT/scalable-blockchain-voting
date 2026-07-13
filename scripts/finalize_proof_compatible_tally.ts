import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  encodeAbiParameters,
  keccak256,
  parseAbiParameters,
  stringToHex,
  type Hex,
} from "viem";

import type { Bytes32 } from "../packages/crypto/src/index.js";
import {
  digestProofCompatibleCiphertext,
  type ProofCompatibleCiphertextJson,
} from "../packages/crypto/src/proofCompatiblePipeline.js";
import {
  createProofCompatibleDecryptionShare,
  createProofCompatibleThresholdKeySet,
  decryptProofCompatibleTallyWithShares,
  digestProofCompatibleDecryptionShare,
} from "../packages/crypto/src/proofCompatibleThreshold.js";

type EncryptedTallyArtifact = {
  electionId: Bytes32;
  candidateListHash: Bytes32;
  ballotCount: number;
  aggregateCiphertext: ProofCompatibleCiphertextJson;
  acceptedBatchManifestDigests: readonly Bytes32[];
  acceptedBatchPublicInputsHashes: readonly Bytes32[];
};

type FinalizeConfig = {
  encryptedTallyPath: string;
  threshold?: number;
  trusteeCount?: number;
  privateKey?: string;
  coefficients?: readonly string[];
  maxVotes?: number;
};

const configPath = process.argv[2];
const outputDirectory = process.argv[3];
if (configPath === undefined || outputDirectory === undefined) {
  throw new Error(
    "usage: npm run finalize:tally:v2 -- finalize-config.json output-directory",
  );
}
const resolvedConfigPath = path.resolve(configPath);
const config = JSON.parse(await readFile(resolvedConfigPath, "utf8")) as FinalizeConfig;
const encryptedTally = JSON.parse(
  await readFile(
    path.resolve(path.dirname(resolvedConfigPath), config.encryptedTallyPath),
    "utf8",
  ),
) as EncryptedTallyArtifact;
const threshold = config.threshold ?? 5;
const trusteeCount = config.trusteeCount ?? 9;
const keySet = await createProofCompatibleThresholdKeySet({
  threshold,
  trusteeCount,
  privateKey: BigInt(config.privateKey ?? "7"),
  coefficients: config.coefficients?.map(BigInt) ?? [11n, 13n, 17n, 19n],
});
if (keySet.publicKeyHash !== encryptedTally.aggregateCiphertext.electionPublicKeyHash) {
  throw new Error("threshold key does not match encrypted tally election key");
}

const shares = await Promise.all(
  keySet.shares.slice(0, threshold).map((share) =>
    createProofCompatibleDecryptionShare({
      trusteeIndex: share.trusteeIndex,
      privateShare: share.privateShare,
      ciphertext: encryptedTally.aggregateCiphertext,
      proofNonces: [0, 1, 2, 3].map(
        (offset) => BigInt(100 + share.trusteeIndex * 10 + offset),
      ),
    }),
  ),
);
const tallyCounts = await decryptProofCompatibleTallyWithShares({
  ciphertext: encryptedTally.aggregateCiphertext,
  shares,
  threshold,
  maxVotes: config.maxVotes ?? encryptedTally.ballotCount,
});
const decryptionShareDigests = shares.map(digestProofCompatibleDecryptionShare);
const aggregateCiphertextDigest = digestProofCompatibleCiphertext(
  encryptedTally.aggregateCiphertext,
);
const domainHash = (value: string) => keccak256(stringToHex(value));
const resultHash = keccak256(
  encodeAbiParameters(
    parseAbiParameters(
      "bytes32 domain, bytes32 electionId, bytes32 candidateListHash, bytes32 aggregateCiphertextDigest, uint32[] tallyCounts, bytes32[] decryptionShareDigests",
    ),
    [
      domainHash("SVB_TALLY_RESULT_V2"),
      encryptedTally.electionId,
      encryptedTally.candidateListHash,
      aggregateCiphertextDigest,
      [...tallyCounts],
      decryptionShareDigests,
    ],
  ),
);
const tallyProofPublicInputsHash = keccak256(
  encodeAbiParameters(
    parseAbiParameters(
      "bytes32 domain, bytes32 electionId, bytes32 candidateListHash, bytes32[] acceptedBatchManifestDigests, bytes32[] acceptedBatchPublicInputsHashes, bytes32 aggregateCiphertextDigest, uint32[] tallyCounts, bytes32[] decryptionShareDigests, bytes32 resultHash",
    ),
    [
      domainHash("SVB_TALLY_PROOF_PUBLIC_INPUTS_V2"),
      encryptedTally.electionId,
      encryptedTally.candidateListHash,
      encryptedTally.acceptedBatchManifestDigests,
      encryptedTally.acceptedBatchPublicInputsHashes,
      aggregateCiphertextDigest,
      [...tallyCounts],
      decryptionShareDigests,
      resultHash,
    ],
  ),
);

const resolvedOutputDirectory = path.resolve(outputDirectory);
await mkdir(resolvedOutputDirectory, { recursive: true });
await Promise.all(
  shares.map((share) =>
    writeFile(
      path.join(resolvedOutputDirectory, `trustee-${share.trusteeIndex}-decryption-share.json`),
      `${JSON.stringify(share, null, 2)}\n`,
    ),
  ),
);
await writeFile(
  path.join(resolvedOutputDirectory, "threshold-public-keyset.json"),
  `${JSON.stringify({
    threshold: keySet.threshold,
    trusteeCount: keySet.trusteeCount,
    publicKey: keySet.publicKey,
    publicKeyHash: keySet.publicKeyHash,
    trusteePublicShares: keySet.shares.map(({ trusteeIndex, publicShare }) => ({
      trusteeIndex,
      publicShare,
    })),
  }, null, 2)}\n`,
);
const resultArtifact = {
  version: 2,
  scheme: "threshold-babyjubjub-elgamal-5-of-9-v1",
  electionId: encryptedTally.electionId,
  candidateListHash: encryptedTally.candidateListHash,
  ballotCount: encryptedTally.ballotCount,
  threshold,
  trusteeCount,
  aggregateCiphertextDigest,
  tallyCounts,
  decryptionShareDigests,
  resultHash,
  tallyProofPublicInputsHash,
  proofStatus: "tally-circuit-pending" as const,
};
await writeFile(
  path.join(resolvedOutputDirectory, "tally-result-v2.json"),
  `${JSON.stringify(resultArtifact, null, 2)}\n`,
);

console.log(JSON.stringify({
  outputDirectory: resolvedOutputDirectory,
  tallyCounts,
  resultHash,
  tallyProofPublicInputsHash,
  shareCount: shares.length,
}, null, 2));
