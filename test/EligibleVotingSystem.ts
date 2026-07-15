import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { keccak256, stringToHex } from "viem";

const electionId = keccak256(stringToHex("eligible-voting-test-election"));
const candidateListHash = keccak256(stringToHex("a,b,c,d"));
const eligibilityRoot =
  "0x12949861ba7288c9ddfecdd8951e7624967f79a6c803a9fc399ac6a36de59070";

describe("root-based eligible voting", async function () {
  const { viem } = await network.create();
  const [owner, relayer] = await viem.getWalletClients();

  it("accepts a relayed proof without per-voter registration and rejects reuse", async function () {
    const roots = await viem.deployContract("EligibilityRootRegistry", [
      electionId, eligibilityRoot, owner.account.address,
    ]);
    const verifier = await viem.deployContract("MockEligibleBallotProofVerifier");
    const voting = await viem.deployContract("EligibleVotingContract", [
      electionId,
      candidateListHash,
      roots.address,
      verifier.address,
      owner.account.address,
    ]);
    const publicInputsHash = keccak256(stringToHex("eligible-public-inputs"));
    const nullifier = `0x${123n.toString(16).padStart(64, "0")}` as const;
    const packageDigest = `0x${456n.toString(16).padStart(64, "0")}` as const;
    await verifier.write.setAccepted([publicInputsHash, true]);
    await assert.rejects(voting.write.submitEligibleBallot([
      eligibilityRoot,
      nullifier,
      packageDigest,
      publicInputsHash,
      "0x1234",
    ], { account: relayer.account }));
    await roots.write.freezeRoot();
    await voting.write.submitEligibleBallot([
      eligibilityRoot,
      nullifier,
      packageDigest,
      publicInputsHash,
      "0x1234",
    ], { account: relayer.account });
    assert.equal(await voting.read.isNullifierUsed([nullifier]), true);
    await assert.rejects(voting.write.submitEligibleBallot([
      eligibilityRoot,
      nullifier,
      packageDigest,
      publicInputsHash,
      "0x1234",
    ], { account: relayer.account }));
  });

  it("invalidates the previous credential root after an authority update", async function () {
    const roots = await viem.deployContract("EligibilityRootRegistry", [
      electionId, eligibilityRoot, owner.account.address,
    ]);
    const verifier = await viem.deployContract("MockEligibleBallotProofVerifier");
    const voting = await viem.deployContract("EligibleVotingContract", [
      electionId,
      candidateListHash,
      roots.address,
      verifier.address,
      owner.account.address,
    ]);
    const newRoot = `0x${789n.toString(16).padStart(64, "0")}` as const;
    await roots.write.updateRoot([newRoot]);
    await roots.write.freezeRoot();
    assert.equal(await roots.read.isCurrentRoot([eligibilityRoot]), false);
    await assert.rejects(roots.write.updateRoot([eligibilityRoot]));
    await assert.rejects(voting.write.submitEligibleBallot([
      eligibilityRoot,
      `0x${1n.toString(16).padStart(64, "0")}`,
      `0x${2n.toString(16).padStart(64, "0")}`,
      keccak256(stringToHex("inputs")),
      "0x1234",
    ], { account: relayer.account }));
  });
});
