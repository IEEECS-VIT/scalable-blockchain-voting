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
  digestVotePackage,
  validateVotePackage,
  verifyMerkleProof,
} from "../packages/crypto/src/index.js";

const hash = (value: string) => keccak256(stringToHex(value));

const electionId = hash("test-election");
const candidateListHash = hash("candidate-list");
const electionPublicKeyHash = hash("election-public-key");

function votePackage(label: string): VotePackageV1 {
  return {
    version: VOTE_PACKAGE_VERSION,
    electionId,
    candidateListHash,
    ballotNullifier: hash(`ballot-nullifier-${label}`),
    ciphertext: {
      scheme: BALLOT_CIPHERTEXT_SCHEME,
      electionPublicKeyHash,
      points: [`0x${"11".repeat(33)}`, `0x${"22".repeat(33)}`],
    },
    ballotValidityProof: {
      system: BALLOT_PROOF_SYSTEM,
      proof: `0x${"aa".repeat(192)}`,
      publicInputsHash: hash(`public-inputs-${label}`),
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
