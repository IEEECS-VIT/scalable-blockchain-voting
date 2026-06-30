import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { keccak256, stringToHex, zeroHash } from "viem";

import {
  BALLOT_CIPHERTEXT_SCHEME,
  BALLOT_PROOF_SYSTEM,
  NullifierAccumulator,
  type VotePackageV1,
  VOTE_PACKAGE_VERSION,
  buildBatchManifest,
  buildInclusionReceipt,
  computeBallotPublicInputsHash,
  createElectionKeyPair,
  digestVotePackage,
  encryptBallotSelection,
  validateVotePackage,
  verifyMerkleProof,
} from "../packages/crypto/src/index.js";

const hash = (value: string) => keccak256(stringToHex(value));

const electionId = hash("test-election");
const candidateListHash = hash("candidate-list");
const electionKey = createElectionKeyPair(
  `0x${"01".padStart(64, "0")}`,
);

function votePackage(label: string): VotePackageV1 {
  const ballotNullifier = hash(`ballot-nullifier-${label}`);
  const ciphertext = encryptBallotSelection({
    electionPublicKey: electionKey.publicKey,
    candidateCount: 3,
    selectedIndex: label.length % 3,
    randomness: [
      `0x${"11".padStart(64, "0")}`,
      `0x${"12".padStart(64, "0")}`,
      `0x${"13".padStart(64, "0")}`,
    ],
  });

  return {
    version: VOTE_PACKAGE_VERSION,
    electionId,
    candidateListHash,
    ballotNullifier,
    ciphertext,
    ballotValidityProof: {
      system: BALLOT_PROOF_SYSTEM,
      proof: `0x${"aa".repeat(192)}`,
      publicInputsHash: computeBallotPublicInputsHash({
        electionId,
        candidateListHash,
        ballotNullifier,
        ciphertext,
      }),
    },
  };
}

describe("crypto batching utilities", function () {
  it("creates stable vote package digests and rejects metadata fields", function () {
    const first = votePackage("a");
    const second = {
      ...first,
      ciphertext: {
        ...first.ciphertext,
        points: [...first.ciphertext.points],
      },
    };

    assert.equal(digestVotePackage(first), digestVotePackage(second));

    assert.throws(() =>
      validateVotePackage({
        ...first,
        timestamp: 1_900_000_000,
      } as unknown as VotePackageV1),
    );
    assert.throws(() =>
      validateVotePackage({
        ...first,
        clientVersion: "demo-browser",
      } as unknown as VotePackageV1),
    );
  });

  it("binds proof public inputs to election, nullifier, and ciphertext", function () {
    const original = votePackage("public-input-binding");
    const changedNullifier = {
      ...original,
      ballotNullifier: hash("changed-nullifier"),
    };
    const changedCiphertext = {
      ...original,
      ciphertext: encryptBallotSelection({
        electionPublicKey: electionKey.publicKey,
        candidateCount: 3,
        selectedIndex: 2,
        randomness: [
          `0x${"21".padStart(64, "0")}`,
          `0x${"22".padStart(64, "0")}`,
          `0x${"23".padStart(64, "0")}`,
        ],
      }),
    };

    assert.throws(() => validateVotePackage(changedNullifier));
    assert.throws(() => validateVotePackage(changedCiphertext));
    assert.notEqual(
      computeBallotPublicInputsHash({
        electionId,
        candidateListHash,
        ballotNullifier: original.ballotNullifier,
        ciphertext: original.ciphertext,
      }),
      computeBallotPublicInputsHash({
        electionId: hash("different-election"),
        candidateListHash,
        ballotNullifier: original.ballotNullifier,
        ciphertext: original.ciphertext,
      }),
    );
  });

  it("builds deterministic batch manifests regardless of package input order", function () {
    const firstAccumulator = new NullifierAccumulator();
    const secondAccumulator = new NullifierAccumulator();
    const packages = [
      { contentId: "ipfs://bafy-demo-c", package: votePackage("c") },
      { contentId: "ipfs://bafy-demo-a", package: votePackage("a") },
      { contentId: "ipfs://bafy-demo-b", package: votePackage("b") },
    ];

    const firstManifest = buildBatchManifest(
      electionId,
      zeroHash,
      packages,
      firstAccumulator,
    );
    const secondManifest = buildBatchManifest(
      electionId,
      zeroHash,
      [...packages].reverse(),
      secondAccumulator,
    );

    assert.equal(firstManifest.cidMerkleRoot, secondManifest.cidMerkleRoot);
    assert.equal(firstManifest.nullifierRoot, secondManifest.nullifierRoot);
    assert.equal(firstManifest.manifestDigest, secondManifest.manifestDigest);
    assert.equal(firstManifest.batchSize, 3n);
  });

  it("rejects duplicate nullifiers and enforces accumulator continuity", function () {
    const accumulator = new NullifierAccumulator();
    const first = votePackage("a");
    const duplicate = {
      ...votePackage("b"),
      ballotNullifier: first.ballotNullifier,
    };

    assert.throws(() =>
      buildBatchManifest(electionId, zeroHash, [
        { contentId: "ipfs://bafy-demo-a", package: first },
        { contentId: "ipfs://bafy-demo-dup", package: duplicate },
      ], accumulator),
    );

    const cleanAccumulator = new NullifierAccumulator();
    const firstManifest = buildBatchManifest(
      electionId,
      zeroHash,
      [{ contentId: "ipfs://bafy-demo-a", package: first }],
      cleanAccumulator,
    );

    assert.throws(() =>
      buildBatchManifest(
        electionId,
        zeroHash,
        [{ contentId: "ipfs://bafy-demo-b", package: votePackage("b") }],
        cleanAccumulator,
      ),
    );

    const secondManifest = buildBatchManifest(
      electionId,
      firstManifest.nullifierRoot,
      [{ contentId: "ipfs://bafy-demo-b", package: votePackage("b") }],
      cleanAccumulator,
    );

    assert.notEqual(firstManifest.nullifierRoot, secondManifest.nullifierRoot);
  });

  it("creates inclusion receipts that verify against the batch root", function () {
    const accumulator = new NullifierAccumulator();
    const targetPackage = votePackage("target");
    const manifest = buildBatchManifest(
      electionId,
      zeroHash,
      [
        { contentId: "ipfs://bafy-demo-a", package: votePackage("a") },
        { contentId: "ipfs://bafy-demo-target", package: targetPackage },
        { contentId: "ipfs://bafy-demo-c", package: votePackage("c") },
      ],
      accumulator,
    );

    const receipt = buildInclusionReceipt(
      manifest,
      digestVotePackage(targetPackage),
    );

    assert.equal(
      verifyMerkleProof(receipt.leafHash, receipt.proof, manifest.cidMerkleRoot),
      true,
    );
    assert.equal(receipt.batchManifestDigest, manifest.manifestDigest);
  });
});
