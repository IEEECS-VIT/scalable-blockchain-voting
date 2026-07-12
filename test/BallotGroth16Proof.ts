import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { keccak256, stringToHex, zeroAddress, type Hex } from "viem";

type BallotProofFixture = {
  proof: Hex;
  publicSignals: readonly string[];
  publicInputsHash: Hex;
};

const fixture = JSON.parse(
  await readFile(
    new URL("./fixtures/ballot-validity/ballot-proof-artifact.json", import.meta.url),
    "utf8",
  ),
) as BallotProofFixture;
const electionId = keccak256(stringToHex("scalable-voting-demo-2026"));
const ballotNullifier = keccak256(stringToHex("demo-ballot-nullifier-1"));
const packageCommitment =
  `0x${BigInt(fixture.publicSignals[3]!).toString(16).padStart(64, "0")}` as Hex;

describe("real Groth16 ballot validity proof", async function () {
  const { viem } = await network.create();
  const [owner, voter] = await viem.getWalletClients();

  it("verifies the generated proof and rejects changed bindings", async function () {
    const groth16Verifier = await viem.deployContract("BallotGroth16Verifier");
    const adapter = await viem.deployContract("BallotGroth16VerifierAdapter", [
      groth16Verifier.address,
    ]);

    assert.equal(
      await adapter.read.verify([
        fixture.proof,
        fixture.publicInputsHash,
        electionId,
        ballotNullifier,
        packageCommitment,
      ]),
      true,
    );
    assert.equal(
      await adapter.read.verify([
        fixture.proof,
        fixture.publicInputsHash,
        electionId,
        keccak256(stringToHex("different-nullifier")),
        packageCommitment,
      ]),
      false,
    );
    assert.equal(
      await adapter.read.verify([
        fixture.proof,
        fixture.publicInputsHash,
        electionId,
        ballotNullifier,
        keccak256(stringToHex("different-package")),
      ]),
      false,
    );

    const changedProof =
      `0x${"0".repeat(64)}${fixture.proof.slice(66)}` as Hex;
    assert.equal(
      await adapter.read.verify([
        changedProof,
        fixture.publicInputsHash,
        electionId,
        ballotNullifier,
        packageCommitment,
      ]),
      false,
    );
  });

  it("accepts the real proof through VotingContract", async function () {
    const groth16Verifier = await viem.deployContract("BallotGroth16Verifier");
    const adapter = await viem.deployContract("BallotGroth16VerifierAdapter", [
      groth16Verifier.address,
    ]);
    const registry = await viem.deployContract("VoterRegistry", [
      electionId,
      owner.account.address,
      zeroAddress,
    ]);
    const voting = await viem.deployContract("VotingContract", [
      electionId,
      registry.address,
      owner.account.address,
      adapter.address,
    ]);
    const identityNullifier = keccak256(stringToHex("groth16-proof-identity"));

    await registry.write.register(
      [identityNullifier, voter.account.address],
      { account: owner.account },
    );
    await voting.write.submitBallotWithProof(
      [
        identityNullifier,
        ballotNullifier,
        packageCommitment,
        fixture.publicInputsHash,
        fixture.proof,
      ],
      { account: voter.account },
    );

    assert.equal(await voting.read.isNullifierUsed([ballotNullifier]), true);
    assert.equal(
      await voting.read.ballotPublicInputsHashOf([ballotNullifier]),
      fixture.publicInputsHash,
    );
  });
});
