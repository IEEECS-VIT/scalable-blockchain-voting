import { dirname, resolve } from "node:path";
import { readFile, writeFile } from "node:fs/promises";

import type { Hex } from "viem";

import {
  hashProofCompatibleElectionPublicKey,
  type BabyJubPoint,
} from "../packages/crypto/src/proofCompatibleBallot.js";
import {
  PROOF_COMPATIBLE_BALLOT_PROOF_SYSTEM,
  PROOF_COMPATIBLE_VOTE_PACKAGE_VERSION,
  digestProofCompatibleVotePackage,
  serializeProofCompatibleVotePackage,
  type ProofCompatibleVotePackageV2,
} from "../packages/crypto/src/proofCompatiblePipeline.js";

type PackageDescriptor = {
  electionId: Hex;
  candidateListHash: Hex;
  ballotNullifier: Hex;
  circuitInputPath: string;
  proofArtifactPath: string;
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
    "usage: npm run build:vote-package:v2 -- descriptor.json vote-package-v2.json",
  );
}

const descriptor = JSON.parse(
  await readFile(resolve(descriptorPath), "utf8"),
) as PackageDescriptor;
const descriptorDirectory = dirname(resolve(descriptorPath));
const circuitInput = JSON.parse(
  await readFile(resolve(descriptorDirectory, descriptor.circuitInputPath), "utf8"),
) as CircuitInput;
const proofArtifact = JSON.parse(
  await readFile(resolve(descriptorDirectory, descriptor.proofArtifactPath), "utf8"),
) as ProofArtifact;
const electionPublicKey = circuitInput.electionPublicKey.map(BigInt) as unknown as BabyJubPoint;

const votePackage: ProofCompatibleVotePackageV2 = {
  version: PROOF_COMPATIBLE_VOTE_PACKAGE_VERSION,
  electionId: descriptor.electionId,
  candidateListHash: descriptor.candidateListHash,
  ballotNullifier: descriptor.ballotNullifier,
  packageCommitment:
    `0x${BigInt(proofArtifact.publicSignals[3]!).toString(16).padStart(64, "0")}`,
  ciphertext: {
    scheme: "ec-elgamal-babyjubjub-affine-v1",
    electionPublicKeyHash: hashProofCompatibleElectionPublicKey(electionPublicKey),
    electionPublicKey: circuitInput.electionPublicKey,
    c1: circuitInput.c1,
    c2: circuitInput.c2,
  },
  ballotValidityProof: {
    system: PROOF_COMPATIBLE_BALLOT_PROOF_SYSTEM,
    proof: proofArtifact.proof,
    publicInputsHash: proofArtifact.publicInputsHash,
  },
};
const serialized = await serializeProofCompatibleVotePackage(votePackage);
await writeFile(resolve(outputPath), serialized);

console.log(JSON.stringify({
  outputPath: resolve(outputPath),
  version: PROOF_COMPATIBLE_VOTE_PACKAGE_VERSION,
  ballotNullifier: votePackage.ballotNullifier,
  packageCommitment: votePackage.packageCommitment,
  packageDigest: await digestProofCompatibleVotePackage(votePackage),
}, null, 2));
