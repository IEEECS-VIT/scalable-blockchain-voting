import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { keccak256, stringToHex, type Hex, zeroAddress, zeroHash } from "viem";

type ProofArtifact = {
  proof: Hex;
  publicSignals: readonly string[];
  publicInputsHash: Hex;
};
const artifact = JSON.parse(await readFile(path.resolve(
  "test/fixtures/eligible-ballot/eligible-ballot-proof-artifact.json",
), "utf8")) as ProofArtifact;
const fieldBytes32 = (index: number): Hex =>
  `0x${BigInt(artifact.publicSignals[index]!).toString(16).padStart(64, "0")}`;

describe("local gas regression benchmark", async function () {
  const { viem } = await network.create();
  const [owner, relayer] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();

  it("measures direct real-proof verification against constant-size commitments", async function () {
    const generated = await viem.deployContract("EligibleBallotGroth16Verifier");
    const adapter = await viem.deployContract("EligibleBallotGroth16VerifierAdapter", [
      generated.address,
    ]);
    const roots = await viem.deployContract("EligibilityRootRegistry", [
      fieldBytes32(0), fieldBytes32(2), owner.account.address,
    ]);
    await roots.write.freezeRoot();
    const voting = await viem.deployContract("EligibleVotingContract", [
      fieldBytes32(0),
      fieldBytes32(1),
      roots.address,
      adapter.address,
      owner.account.address,
    ]);
    const directHash = await voting.write.submitEligibleBallot([
      fieldBytes32(2),
      fieldBytes32(3),
      fieldBytes32(4),
      artifact.publicInputsHash,
      artifact.proof,
    ], { account: relayer.account });
    const directReceipt = await publicClient.waitForTransactionReceipt({ hash: directHash });

    const batchGasBySize: Record<string, string> = {};
    for (const batchSize of [64n, 1024n, 4096n]) {
      const commitment = await viem.deployContract("BatchCommitment", [
        fieldBytes32(0),
        owner.account.address,
        owner.account.address,
        zeroAddress,
      ]);
      const transactionHash = await commitment.write.submitBatch([
        keccak256(stringToHex(`gas-cid-root-${batchSize}`)),
        zeroHash,
        keccak256(stringToHex(`gas-nullifier-root-${batchSize}`)),
        keccak256(stringToHex(`gas-manifest-${batchSize}`)),
        batchSize,
      ], { account: owner.account });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash });
      batchGasBySize[batchSize.toString()] = receipt.gasUsed.toString();
    }
    const directGas = directReceipt.gasUsed;
    const batch4096Gas = BigInt(batchGasBySize["4096"]!);
    assert.equal(directGas < 2_000_000n, true, "direct verifier gas regressed unexpectedly");
    assert.equal(batch4096Gas < 300_000n, true, "batch commitment gas regressed unexpectedly");
    assert.equal(batch4096Gas < directGas, true);
    const batchGasValues = Object.values(batchGasBySize).map(BigInt);
    const batchGasSpread = batchGasValues.reduce(
      (largest, value) => value > largest ? value : largest,
      batchGasValues[0]!,
    ) - batchGasValues.reduce(
      (smallest, value) => value < smallest ? value : smallest,
      batchGasValues[0]!,
    );
    assert.equal(
      batchGasSpread <= 1_000n,
      true,
      "commitment gas should remain effectively constant across batch sizes",
    );

    console.log(`LOCAL_GAS_BENCHMARK ${JSON.stringify({
      network: "hardhat-local",
      units: "gas-not-currency",
      directEligibleBallotWithRealGroth16Proof: directGas.toString(),
      trustedBatchCommitmentByBatchSize: batchGasBySize,
      batch4096AmortizedGasPerVoteNumerator: batch4096Gas.toString(),
      batch4096AmortizedGasPerVoteDenominator: "4096",
      warning: "Batch commitment is trusted until recursive ballot-proof aggregation exists.",
    })}`);
  });
});
