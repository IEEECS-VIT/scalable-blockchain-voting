import { dirname, resolve } from "node:path";
import { readFile, writeFile } from "node:fs/promises";

import type { Hex } from "viem";

import { hashProofCompatibleElectionPublicKey, type BabyJubPoint } from
  "../packages/crypto/src/proofCompatibleBallot.js";
import {
  ELIGIBLE_VOTE_PACKAGE_VERSION,
  digestEligibleVotePackage,
  serializeEligibleVotePackage,
  verifyEligibleVotePackageProof,
  type EligibleVotePackageV3,
} from "../packages/crypto/src/eligiblePipeline.js";

type PackageDescriptor = {
  electionId: Hex;
  candidateListHash: Hex;
  circuitInputPath: string;
  proofArtifactPath: string;
  verificationKeyPath?: string;
};

type CircuitInput = {
  electionPublicKey: readonly [string, string];
  c1: readonly (readonly [string, string])[];
  c2: readonly (readonly [string, string])[];
};

type ProofArtifact = {
  proof: Hex;
  publicSignals: readonly string[];
  publicInputsHash: Hex;
};

const descriptorPath = process.argv[2];
const outputPath = process.argv[3];
if (descriptorPath === undefined || outputPath === undefined) {
  throw new Error(
    "usage: npm run build:vote-package:v3 -- descriptor.json vote-package-v3.json",
  );
}

const resolvedDescriptorPath = resolve(descriptorPath);
const descriptorDirectory = dirname(resolvedDescriptorPath);
const descriptor = JSON.parse(await readFile(resolvedDescriptorPath, "utf8")) as PackageDescriptor;
const circuitInput = JSON.parse(await readFile(
  resolve(descriptorDirectory, descriptor.circuitInputPath), "utf8",
)) as CircuitInput;
const proofArtifact = JSON.parse(await readFile(
  resolve(descriptorDirectory, descriptor.proofArtifactPath), "utf8",
)) as ProofArtifact;
const verificationKey = JSON.parse(await readFile(
  descriptor.verificationKeyPath === undefined
    ? resolve("circuits/build/eligible_ballot/verification_key.json")
    : resolve(descriptorDirectory, descriptor.verificationKeyPath),
  "utf8",
)) as unknown;
if (proofArtifact.publicSignals.length !== 23) {
  throw new Error("eligible ballot proof must have 23 public signals");
}
const fieldBytes32 = (index: number): Hex =>
  `0x${BigInt(proofArtifact.publicSignals[index]!).toString(16).padStart(64, "0")}`;
const electionPublicKey = circuitInput.electionPublicKey.map(BigInt) as unknown as BabyJubPoint;

const votePackage: EligibleVotePackageV3 = {
  version: ELIGIBLE_VOTE_PACKAGE_VERSION,
  electionId: descriptor.electionId,
  candidateListHash: descriptor.candidateListHash,
  eligibilityRoot: fieldBytes32(2),
  ballotNullifier: fieldBytes32(3),
  packageCommitment: fieldBytes32(4),
  ciphertext: {
    scheme: "ec-elgamal-babyjubjub-affine-v1",
    electionPublicKeyHash: hashProofCompatibleElectionPublicKey(electionPublicKey),
    electionPublicKey: circuitInput.electionPublicKey,
    c1: circuitInput.c1,
    c2: circuitInput.c2,
  },
  ballotValidityProof: {
    system: "groth16-eligible-ballot-babyjubjub-v1",
    proof: proofArtifact.proof,
    publicInputsHash: proofArtifact.publicInputsHash,
  },
};
if (!await verifyEligibleVotePackageProof(votePackage, verificationKey)) {
  throw new Error("eligible ballot Groth16 proof rejected");
}
await writeFile(resolve(outputPath), await serializeEligibleVotePackage(votePackage));

console.log(JSON.stringify({
  outputPath: resolve(outputPath),
  version: ELIGIBLE_VOTE_PACKAGE_VERSION,
  eligibilityRoot: votePackage.eligibilityRoot,
  ballotNullifier: votePackage.ballotNullifier,
  packageCommitment: votePackage.packageCommitment,
  packageDigest: await digestEligibleVotePackage(votePackage),
  proofVerified: true,
}, null, 2));
