import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { keccak256, stringToHex, zeroAddress, zeroHash } from "viem";

import { computeRegistrationPublicInputsHash } from "../packages/crypto/src/index.js";

const electionId = keccak256(stringToHex("test-election"));

describe("Voting system foundation", async function () {
  const { viem } = await network.create();
  const [owner, voter, outsider] = await viem.getWalletClients();

  it("registers an ephemeral voting key and accepts one ballot nullifier", async function () {
    const registry = await viem.deployContract("VoterRegistry", [
      electionId,
      owner.account.address,
      zeroAddress,
    ]);
    const voting = await viem.deployContract("VotingContract", [
      electionId,
      registry.address,
    ]);

    const identityNullifier = keccak256(stringToHex("identity-nullifier"));
    const ballotNullifier = keccak256(stringToHex("ballot-nullifier"));
    const packageDigest = keccak256(stringToHex("ipfs-package"));

    await registry.write.register(
      [identityNullifier, voter.account.address],
      { account: owner.account },
    );
    await voting.write.submitBallot(
      [identityNullifier, ballotNullifier, packageDigest],
      { account: voter.account },
    );

    assert.equal(
      await voting.read.isNullifierUsed([ballotNullifier]),
      true,
    );

    await assert.rejects(
      voting.write.submitBallot(
        [identityNullifier, ballotNullifier, packageDigest],
        { account: voter.account },
      ),
    );
    await assert.rejects(
      voting.write.submitBallot(
        [
          identityNullifier,
          keccak256(stringToHex("another-nullifier")),
          packageDigest,
        ],
        { account: outsider.account },
      ),
    );
  });

  it("registers through an eligibility verifier seam", async function () {
    const verifier = await viem.deployContract("MockEligibilityVerifier");
    const registry = await viem.deployContract("VoterRegistry", [
      electionId,
      owner.account.address,
      verifier.address,
    ]);

    const identityNullifier = keccak256(
      stringToHex("proof-identity-nullifier"),
    );
    const publicInputsHash = await registry.read.registrationPublicInputsHash([
      identityNullifier,
      voter.account.address,
    ]);
    const offChainPublicInputsHash = computeRegistrationPublicInputsHash({
      electionId,
      identityNullifier,
      votingKey: voter.account.address,
    });

    assert.equal(publicInputsHash, offChainPublicInputsHash);

    await verifier.write.setAccepted([publicInputsHash, true], {
      account: owner.account,
    });
    await registry.write.registerWithProof(
      [identityNullifier, voter.account.address, "0x1234"],
      { account: outsider.account },
    );

    const registeredVotingKey = await registry.read.votingKeyOf([
      identityNullifier,
    ]) as string;
    assert.equal(registeredVotingKey.toLowerCase(), voter.account.address.toLowerCase());
  });

  it("rejects proof registration without an accepted eligibility proof", async function () {
    const verifier = await viem.deployContract("MockEligibilityVerifier");
    const registry = await viem.deployContract("VoterRegistry", [
      electionId,
      owner.account.address,
      verifier.address,
    ]);

    await assert.rejects(
      registry.write.registerWithProof(
        [
          keccak256(stringToHex("unaccepted-identity")),
          voter.account.address,
          "0x1234",
        ],
        { account: outsider.account },
      ),
    );
  });

  it("enforces batcher authorization and nullifier-root continuity", async function () {
    const batcher = await viem.deployContract("BatchCommitment", [
      electionId,
      owner.account.address,
      owner.account.address,
    ]);

    const firstRoot = keccak256(stringToHex("batch-root-1"));
    const firstNullifierRoot = keccak256(
      stringToHex("nullifier-root-1"),
    );
    const manifestDigest = keccak256(stringToHex("manifest-1"));

    await batcher.write.submitBatch(
      [firstRoot, zeroHash, firstNullifierRoot, manifestDigest, 10n],
      { account: owner.account },
    );

    assert.equal(await batcher.read.batchCount(), 1n);
    assert.equal(await batcher.read.latestNullifierRoot(), firstNullifierRoot);

    await assert.rejects(
      batcher.write.submitBatch(
        [
          keccak256(stringToHex("batch-root-2")),
          zeroHash,
          keccak256(stringToHex("nullifier-root-2")),
          keccak256(stringToHex("manifest-2")),
          5n,
        ],
        { account: owner.account },
      ),
    );
  });

  it("cannot publish a tally without a configured proof verifier", async function () {
    const tally = await viem.deployContract("TallyVerifier", [
      electionId,
      owner.account.address,
      "0x0000000000000000000000000000000000000000",
    ]);

    await assert.rejects(
      tally.write.publishTally(
        [
          keccak256(stringToHex("result")),
          keccak256(stringToHex("public-inputs")),
          "0x1234",
        ],
        { account: owner.account },
      ),
    );
    assert.equal(await tally.read.resultPublished(), false);
  });
});
