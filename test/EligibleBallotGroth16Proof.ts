import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { type Hex } from "viem";

type EligibleProofArtifact = {
  proof: Hex;
  publicSignals: readonly string[];
  publicInputsHash: Hex;
};

const artifact = JSON.parse(await readFile(
  path.resolve("test/fixtures/eligible-ballot/eligible-ballot-proof-artifact.json"),
  "utf8",
)) as EligibleProofArtifact;
const signalBytes32 = (index: number) =>
  `0x${BigInt(artifact.publicSignals[index]!).toString(16).padStart(64, "0")}` as Hex;

describe("real unified eligibility and ballot proof", async function () {
  const { viem } = await network.create();
  const [owner, relayer] = await viem.getWalletClients();

  async function deploy() {
    const generated = await viem.deployContract("EligibleBallotGroth16Verifier");
    const adapter = await viem.deployContract("EligibleBallotGroth16VerifierAdapter", [generated.address]);
    const electionId = signalBytes32(0);
    const candidateListHash = signalBytes32(1);
    const eligibilityRoot = signalBytes32(2);
    const roots = await viem.deployContract("EligibilityRootRegistry", [
      electionId, eligibilityRoot, owner.account.address,
    ]);
    await roots.write.freezeRoot();
    const voting = await viem.deployContract("EligibleVotingContract", [
      electionId,
      candidateListHash,
      roots.address,
      adapter.address,
      owner.account.address,
    ]);
    return { adapter, voting, electionId, candidateListHash, eligibilityRoot };
  }

  it("verifies membership, nullifier derivation and encrypted ballot as one proof", async function () {
    const { adapter, electionId, candidateListHash, eligibilityRoot } = await deploy();
    assert.equal(await adapter.read.verify([
      artifact.proof,
      artifact.publicInputsHash,
      electionId,
      candidateListHash,
      eligibilityRoot,
      signalBytes32(3),
      signalBytes32(4),
    ]), true);
    assert.equal(await adapter.read.verify([
      artifact.proof,
      artifact.publicInputsHash,
      electionId,
      candidateListHash,
      `0x${(BigInt(eligibilityRoot) + 1n).toString(16).padStart(64, "0")}`,
      signalBytes32(3),
      signalBytes32(4),
    ]), false);
  });

  it("allows an unrelated relayer to submit without registering the voter on-chain", async function () {
    const { voting, eligibilityRoot } = await deploy();
    await voting.write.submitEligibleBallot([
      eligibilityRoot,
      signalBytes32(3),
      signalBytes32(4),
      artifact.publicInputsHash,
      artifact.proof,
    ], { account: relayer.account });
    assert.equal(await voting.read.isNullifierUsed([signalBytes32(3)]), true);
    await assert.rejects(voting.write.submitEligibleBallot([
      eligibilityRoot,
      signalBytes32(3),
      signalBytes32(4),
      artifact.publicInputsHash,
      artifact.proof,
    ], { account: relayer.account }));
  });
});
