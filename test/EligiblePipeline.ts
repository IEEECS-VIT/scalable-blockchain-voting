import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  decodeAbiParameters,
  encodeAbiParameters,
  keccak256,
  parseAbiParameters,
  stringToHex,
  zeroHash,
  type Hex,
} from "viem";

import { NullifierAccumulator, verifyMerkleProof } from "../packages/crypto/src/index.js";
import { hashProofCompatibleElectionPublicKey, type BabyJubPoint } from
  "../packages/crypto/src/proofCompatibleBallot.js";
import { decryptProofCompatibleTally } from
  "../packages/crypto/src/proofCompatiblePipeline.js";
import {
  ELIGIBLE_BATCH_VERIFICATION_MODE,
  ELIGIBLE_VOTE_PACKAGE_VERSION,
  buildEligibleBatchManifest,
  buildEligibleInclusionReceipt,
  digestEligibleVotePackage,
  parseEligibleVotePackageJson,
  serializeEligibleVotePackage,
  validateEligibleVotePackage,
  verifyEligibleVotePackageProof,
  type EligibleVotePackageV3,
} from "../packages/crypto/src/eligiblePipeline.js";

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

const electionId = keccak256(stringToHex("scalable-voting-demo-2026"));
const candidateListHash = keccak256(
  stringToHex("candidate-a,candidate-b,candidate-c,candidate-d"),
);
const verificationKey = JSON.parse(await readFile(
  new URL("../circuits/build/eligible_ballot/verification_key.json", import.meta.url),
  "utf8",
)) as unknown;
const fieldBytes32 = (value: string): Hex =>
  `0x${BigInt(value).toString(16).padStart(64, "0")}`;

async function packageFromFixture(fixtureDirectory: string): Promise<EligibleVotePackageV3> {
  const base = new URL(`./fixtures/${fixtureDirectory}/`, import.meta.url);
  const input = JSON.parse(await readFile(new URL("input.json", base), "utf8")) as CircuitInput;
  const artifact = JSON.parse(await readFile(
    new URL("eligible-ballot-proof-artifact.json", base), "utf8",
  )) as ProofArtifact;
  const electionPublicKey = input.electionPublicKey.map(BigInt) as unknown as BabyJubPoint;
  return {
    version: ELIGIBLE_VOTE_PACKAGE_VERSION,
    electionId,
    candidateListHash,
    eligibilityRoot: fieldBytes32(artifact.publicSignals[2]!),
    ballotNullifier: fieldBytes32(artifact.publicSignals[3]!),
    packageCommitment: fieldBytes32(artifact.publicSignals[4]!),
    ciphertext: {
      scheme: "ec-elgamal-babyjubjub-affine-v1",
      electionPublicKeyHash: hashProofCompatibleElectionPublicKey(electionPublicKey),
      electionPublicKey: input.electionPublicKey,
      c1: input.c1,
      c2: input.c2,
    },
    ballotValidityProof: {
      system: "groth16-eligible-ballot-babyjubjub-v1",
      proof: artifact.proof,
      publicInputsHash: artifact.publicInputsHash,
    },
  };
}

describe("eligible V3 package and batch pipeline", function () {
  it("canonically packages and cryptographically verifies a unified proof", async function () {
    const votePackage = await packageFromFixture("eligible-ballot");
    const validated = await validateEligibleVotePackage(votePackage);
    assert.equal(await verifyEligibleVotePackageProof(validated, verificationKey), true);
    const serialized = await serializeEligibleVotePackage(validated);
    const parsed = await parseEligibleVotePackageJson(serialized);
    assert.equal(
      await digestEligibleVotePackage(parsed),
      await digestEligibleVotePackage(votePackage),
    );
    assert.equal(serialized.includes("credentialSecret"), false);
    assert.equal(serialized.includes("selection"), false);
    assert.equal(serialized.includes("randomness"), false);
  });

  it("rejects root, ciphertext, metadata, and cryptographic proof tampering", async function () {
    const votePackage = await packageFromFixture("eligible-ballot");
    await assert.rejects(validateEligibleVotePackage({
      ...votePackage,
      eligibilityRoot: fieldBytes32((BigInt(votePackage.eligibilityRoot) + 1n).toString()),
    }));
    const changedCiphertext = structuredClone(votePackage);
    changedCiphertext.ciphertext.c2 = [
      changedCiphertext.ciphertext.c2[1]!,
      ...changedCiphertext.ciphertext.c2.slice(1),
    ];
    await assert.rejects(validateEligibleVotePackage(changedCiphertext));
    await assert.rejects(validateEligibleVotePackage({
      ...votePackage,
      device: "fingerprinting-field",
    } as unknown as EligibleVotePackageV3));

    const decoded = decodeAbiParameters(
      parseAbiParameters(
        "uint256[2] pA, uint256[2][2] pB, uint256[2] pC, uint256[23] publicSignals",
      ),
      votePackage.ballotValidityProof.proof,
    );
    const tamperedProof = encodeAbiParameters(
      parseAbiParameters(
        "uint256[2] pA, uint256[2][2] pB, uint256[2] pC, uint256[23] publicSignals",
      ),
      [[decoded[0][0] + 1n, decoded[0][1]], decoded[1], decoded[2], decoded[3]],
    );
    assert.equal(await verifyEligibleVotePackageProof({
      ...votePackage,
      ballotValidityProof: { ...votePackage.ballotValidityProof, proof: tamperedProof },
    }, verificationKey), false);
  });

  it("builds a root-bound deterministic batch, aggregate tally, and receipts", async function () {
    const first = await packageFromFixture("eligible-ballot");
    const second = await packageFromFixture("eligible-ballot-2");
    const stored = [
      { contentId: "ipfs://eligible-vote-1", package: first },
      { contentId: "ipfs://eligible-vote-2", package: second },
    ];
    const manifest = await buildEligibleBatchManifest(
      electionId, first.eligibilityRoot, zeroHash, stored,
      new NullifierAccumulator(), verificationKey,
    );
    const reordered = await buildEligibleBatchManifest(
      electionId, first.eligibilityRoot, zeroHash, [...stored].reverse(),
      new NullifierAccumulator(), verificationKey,
    );
    assert.equal(manifest.version, 3);
    assert.equal(manifest.verificationMode, ELIGIBLE_BATCH_VERIFICATION_MODE);
    assert.equal(manifest.batchSize, 2n);
    assert.equal(manifest.manifestDigest, reordered.manifestDigest);
    assert.equal(manifest.eligibilityRoot, first.eligibilityRoot);
    assert.equal(manifest.ballotProofPublicInputsHashes.length, 2);
    assert.deepEqual(await decryptProofCompatibleTally({
      privateKey: 7n,
      ciphertext: manifest.aggregateCiphertext,
      maxVotes: 2,
    }), [0, 1, 1, 0]);

    const receipt = await buildEligibleInclusionReceipt(manifest, first);
    assert.equal(
      verifyMerkleProof(receipt.leafHash, receipt.proof, manifest.cidMerkleRoot),
      true,
    );
  });

  it("rejects duplicate nullifiers, stale eligibility roots, and invalid proofs", async function () {
    const first = await packageFromFixture("eligible-ballot");
    await assert.rejects(buildEligibleBatchManifest(
      electionId,
      first.eligibilityRoot,
      zeroHash,
      [
        { contentId: "ipfs://duplicate-1", package: first },
        { contentId: "ipfs://duplicate-2", package: first },
      ],
      new NullifierAccumulator(),
      verificationKey,
    ));
    await assert.rejects(buildEligibleBatchManifest(
      electionId,
      fieldBytes32((BigInt(first.eligibilityRoot) + 1n).toString()),
      zeroHash,
      [{ contentId: "ipfs://stale-root", package: first }],
      new NullifierAccumulator(),
      verificationKey,
    ));

    const decoded = decodeAbiParameters(
      parseAbiParameters(
        "uint256[2] pA, uint256[2][2] pB, uint256[2] pC, uint256[23] publicSignals",
      ),
      first.ballotValidityProof.proof,
    );
    const badProof = encodeAbiParameters(
      parseAbiParameters(
        "uint256[2] pA, uint256[2][2] pB, uint256[2] pC, uint256[23] publicSignals",
      ),
      [[decoded[0][0] + 1n, decoded[0][1]], decoded[1], decoded[2], decoded[3]],
    );
    await assert.rejects(buildEligibleBatchManifest(
      electionId,
      first.eligibilityRoot,
      zeroHash,
      [{
        contentId: "ipfs://invalid-proof",
        package: {
          ...first,
          ballotValidityProof: { ...first.ballotValidityProof, proof: badProof },
        },
      }],
      new NullifierAccumulator(),
      verificationKey,
    ));
  });
});
