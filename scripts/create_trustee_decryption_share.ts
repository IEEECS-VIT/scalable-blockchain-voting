import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ProofCompatibleCiphertextJson, ProofCompatiblePointJson } from
  "../packages/crypto/src/proofCompatiblePipeline.js";
import {
  createProofCompatibleDecryptionShare,
  digestProofCompatibleDecryptionShare,
} from "../packages/crypto/src/proofCompatibleThreshold.js";

type PrivateTrusteeShare = {
  trusteeIndex: number;
  privateShare: string;
  publicShare: ProofCompatiblePointJson;
  electionPublicKeyHash: string;
  transcriptDigest: string;
};
type EncryptedTally = {
  aggregateCiphertext: ProofCompatibleCiphertextJson;
  encryptedTallyPublicInputsHash: string;
};

const privateSharePath = process.argv[2];
const encryptedTallyPath = process.argv[3];
const outputPath = process.argv[4];
if (privateSharePath === undefined || encryptedTallyPath === undefined || outputPath === undefined) {
  throw new Error(
    "usage: npm run trustee:decrypt-share -- private-share.json encrypted-tally-v3.json public-share.json",
  );
}
const privateShare = JSON.parse(await readFile(path.resolve(privateSharePath), "utf8")) as PrivateTrusteeShare;
const encryptedTally = JSON.parse(await readFile(path.resolve(encryptedTallyPath), "utf8")) as EncryptedTally;
if (privateShare.electionPublicKeyHash !== encryptedTally.aggregateCiphertext.electionPublicKeyHash) {
  throw new Error("trustee private share belongs to another election key");
}
const share = await createProofCompatibleDecryptionShare({
  trusteeIndex: privateShare.trusteeIndex,
  privateShare: privateShare.privateShare,
  ciphertext: encryptedTally.aggregateCiphertext,
});
if (JSON.stringify(share.trusteePublicShare) !== JSON.stringify(privateShare.publicShare)) {
  throw new Error("private trustee share does not match ceremony public share");
}
const artifact = {
  version: 1,
  ceremonyTranscriptDigest: privateShare.transcriptDigest,
  encryptedTallyPublicInputsHash: encryptedTally.encryptedTallyPublicInputsHash,
  share,
  shareDigest: digestProofCompatibleDecryptionShare(share),
};
await writeFile(path.resolve(outputPath), `${JSON.stringify(artifact, null, 2)}\n`);
console.log(JSON.stringify({
  outputPath: path.resolve(outputPath),
  trusteeIndex: share.trusteeIndex,
  shareDigest: artifact.shareDigest,
  proofCount: share.proofs.length,
  privateShareDisclosed: false,
}, null, 2));
