import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

import { network } from "hardhat";
import {
  keccak256,
  stringToHex,
  zeroAddress,
  zeroHash,
  type Hex,
} from "viem";

const electionId = keccak256(stringToHex("adversarial-election"));
const candidateListHash = keccak256(stringToHex("a,b,c,d"));

type ProofArtifact = {
  proof: Hex;
  publicSignals: readonly string[];
  publicInputsHash: Hex;
};
const eligibleArtifact = JSON.parse(await readFile(path.resolve(
  "test/fixtures/eligible-ballot/eligible-ballot-proof-artifact.json",
), "utf8")) as ProofArtifact;
const fieldBytes32 = (index: number): Hex =>
  `0x${BigInt(eligibleArtifact.publicSignals[index]!).toString(16).padStart(64, "0")}`;

describe("adversarial — contract negative tests", async function () {
  const { viem } = await network.create();
  const [owner, relayer] = await viem.getWalletClients();

  it("rejects a duplicate nullifier in VotingContract", async function () {
    const registry = await viem.deployContract("VoterRegistry", [
      electionId, owner.account.address, zeroAddress,
    ]);
    const voting = await viem.deployContract("VotingContract", [
      electionId, candidateListHash, registry.address, owner.account.address, zeroAddress,
    ]);
    const identityNullifier = keccak256(stringToHex("adversarial-dup-id"));
    const ballotNullifier = keccak256(stringToHex("adversarial-dup-null"));
    const pkg = keccak256(stringToHex("adversarial-dup-pkg"));
    await registry.write.register([identityNullifier, relayer.account.address], { account: owner.account });
    await voting.write.submitBallot([identityNullifier, ballotNullifier, pkg], { account: relayer.account });
    await assert.rejects(
      voting.write.submitBallot([identityNullifier, ballotNullifier, pkg], { account: relayer.account }),
    );
  });

  it("rejects a duplicate nullifier in EligibleVotingContract", async function () {
    const roots = await viem.deployContract("EligibilityRootRegistry", [
      electionId, `0x${1n.toString(16).padStart(64, "0")}`, owner.account.address,
    ]);
    const verifier = await viem.deployContract("MockEligibleBallotProofVerifier");
    const voting = await viem.deployContract("EligibleVotingContract", [
      electionId, candidateListHash, roots.address, verifier.address, owner.account.address,
    ]);
    const nullifier = `0x${2n.toString(16).padStart(64, "0")}` as const;
    const pkg = `0x${3n.toString(16).padStart(64, "0")}` as const;
    const pi = keccak256(stringToHex("adversarial-dup-eligible-pi"));
    await verifier.write.setAccepted([pi, true]);
    await roots.write.freezeRoot();
    const root = await roots.read.currentRoot();
    await voting.write.submitEligibleBallot([root, nullifier, pkg, pi, "0x1234"], { account: relayer.account });
    await assert.rejects(
      voting.write.submitEligibleBallot([root, nullifier, pkg, pi, "0x1234"], { account: relayer.account }),
    );
  });

  it("rejects ballot bound to wrong electionId via real verifier adapter", async function () {
    const generated = await viem.deployContract("EligibleBallotGroth16Verifier");
    const adapter = await viem.deployContract("EligibleBallotGroth16VerifierAdapter", [generated.address]);
    const roots = await viem.deployContract("EligibilityRootRegistry", [
      electionId, fieldBytes32(2), owner.account.address,
    ]);
    await roots.write.freezeRoot();
    const wrongElection = await viem.deployContract("EligibleVotingContract", [
      keccak256(stringToHex("wrong-election")), candidateListHash, roots.address, adapter.address, owner.account.address,
    ]);
    await assert.rejects(
      wrongElection.write.submitEligibleBallot([
        fieldBytes32(2), fieldBytes32(3), fieldBytes32(4),
        eligibleArtifact.publicInputsHash, eligibleArtifact.proof,
      ], { account: relayer.account }),
    );
  });

  it("rejects ballot bound to wrong candidate list hash via real verifier", async function () {
    const generated = await viem.deployContract("EligibleBallotGroth16Verifier");
    const adapter = await viem.deployContract("EligibleBallotGroth16VerifierAdapter", [generated.address]);
    const roots = await viem.deployContract("EligibilityRootRegistry", [
      electionId, fieldBytes32(2), owner.account.address,
    ]);
    await roots.write.freezeRoot();
    const wrongCandidates = await viem.deployContract("EligibleVotingContract", [
      electionId, keccak256(stringToHex("wrong-candidates")),
      roots.address, adapter.address, owner.account.address,
    ]);
    await assert.rejects(
      wrongCandidates.write.submitEligibleBallot([
        fieldBytes32(2), fieldBytes32(3), fieldBytes32(4),
        eligibleArtifact.publicInputsHash, eligibleArtifact.proof,
      ], { account: relayer.account }),
    );
  });

  it("rejects submission with frozen but non-current root", async function () {
    const roots = await viem.deployContract("EligibilityRootRegistry", [
      electionId, `0x${100n.toString(16).padStart(64, "0")}`, owner.account.address,
    ]);
    const verifier = await viem.deployContract("MockEligibleBallotProofVerifier");
    const voting = await viem.deployContract("EligibleVotingContract", [
      electionId, candidateListHash, roots.address, verifier.address, owner.account.address,
    ]);
    const oldRoot = await roots.read.currentRoot();
    await roots.write.updateRoot([`0x${200n.toString(16).padStart(64, "0")}`]);
    await roots.write.freezeRoot();
    const pi = keccak256(stringToHex("adversarial-stale"));
    await verifier.write.setAccepted([pi, true]);
    await assert.rejects(
      voting.write.submitEligibleBallot([
        oldRoot, `0x${300n.toString(16).padStart(64, "0")}`,
        `0x${400n.toString(16).padStart(64, "0")}`, pi, "0x1234",
      ], { account: relayer.account }),
    );
  });

  it("rejects duplicate batch root in BatchCommitment", async function () {
    const batcher = await viem.deployContract("BatchCommitment", [
      electionId, owner.account.address, owner.account.address, zeroAddress,
    ]);
    const root = keccak256(stringToHex("adversarial-dup-root"));
    const nr = keccak256(stringToHex("adversarial-dup-nr"));
    const m = keccak256(stringToHex("adversarial-dup-m"));
    await batcher.write.submitBatch([root, zeroHash, nr, m, 10n], { account: owner.account });
    await assert.rejects(
      batcher.write.submitBatch([root, nr, keccak256(stringToHex("x")), keccak256(stringToHex("y")), 5n], { account: owner.account }),
    );
  });

  it("rejects batch from unauthorized address", async function () {
    const batcher = await viem.deployContract("BatchCommitment", [
      electionId, owner.account.address, owner.account.address, zeroAddress,
    ]);
    const relayer2 = (await viem.getWalletClients())[2]!;
    await assert.rejects(
      batcher.write.submitBatch([
        keccak256(stringToHex("r")), zeroHash, keccak256(stringToHex("nr")),
        keccak256(stringToHex("m")), 5n,
      ], { account: relayer2.account }),
    );
  });

  it("rejects zero-address receipt signer", async function () {
    const batch = await viem.deployContract("BatchCommitment", [
      electionId, owner.account.address, owner.account.address, zeroAddress,
    ]);
    const receipts = await viem.deployContract("BatcherReceiptRegistry", [
      electionId, owner.account.address, batch.address, owner.account.address,
    ]);
    await assert.rejects(
      receipts.write.setReceiptSigner([zeroAddress, true], { account: owner.account }),
    );
  });

  it("rejects tally publication without a verifier", async function () {
    const tally = await viem.deployContract("TallyVerifier", [
      electionId, owner.account.address, zeroAddress,
    ]);
    await assert.rejects(
      tally.write.publishTally([
        keccak256(stringToHex("r")), keccak256(stringToHex("pi")), "0x1234",
      ], { account: owner.account }),
    );
  });

  it("rejects tally publication from non-owner", async function () {
    const verifier = await viem.deployContract("MockTallyProofVerifier");
    const tally = await viem.deployContract("TallyVerifier", [
      electionId, owner.account.address, verifier.address,
    ]);
    const pi = keccak256(stringToHex("pi"));
    await verifier.write.setAccepted([pi, true]);
    const relayer2 = (await viem.getWalletClients())[2]!;
    await assert.rejects(
      tally.write.publishTally([
        keccak256(stringToHex("r")), pi, "0x1234",
      ], { account: relayer2.account }),
    );
  });

  it("rejects invalid batch parameters (zero values)", async function () {
    const batcher = await viem.deployContract("BatchCommitment", [
      electionId, owner.account.address, owner.account.address, zeroAddress,
    ]);
    for (const args of [
      [zeroHash, zeroHash, keccak256(stringToHex("nr")), keccak256(stringToHex("m")), 5n],
      [keccak256(stringToHex("r")), zeroHash, zeroHash, keccak256(stringToHex("m")), 5n],
      [keccak256(stringToHex("r")), zeroHash, keccak256(stringToHex("nr")), zeroHash, 5n],
      [keccak256(stringToHex("r")), zeroHash, keccak256(stringToHex("nr")), keccak256(stringToHex("m")), 0n],
    ] as const) {
      await assert.rejects(batcher.write.submitBatch([...args], { account: owner.account }));
    }
  });
});
