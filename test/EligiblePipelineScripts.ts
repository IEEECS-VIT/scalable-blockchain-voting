import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { keccak256, stringToHex, zeroHash } from "viem";

async function runScript(script: string, args: readonly string[], succeeds = true) {
  const child = spawn(process.execPath, ["--import", "tsx", script, ...args], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
  child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill("SIGTERM");
  }, 30_000);
  const [exitCode] = await once(child, "close") as [number];
  clearTimeout(timeout);
  assert.equal(timedOut, false, `${script} did not terminate within 30 seconds`);
  if (succeeds) {
    assert.equal(exitCode, 0, Buffer.concat(stderr).toString());
  } else {
    assert.notEqual(exitCode, 0, "tampered artifact should be rejected");
  }
  return {
    stdout: Buffer.concat(stdout).toString(),
    stderr: Buffer.concat(stderr).toString(),
  };
}

describe("eligible V3 command pipeline", function () {
  it("runs packages, batch, tally, isolated trustee shares, and finalization", async function () {
    const directory = await mkdtemp(path.join(tmpdir(), "svb-v3-pipeline-"));
    try {
      const electionId = keccak256(stringToHex("scalable-voting-demo-2026"));
      const candidateListHash = keccak256(
        stringToHex("candidate-a,candidate-b,candidate-c,candidate-d"),
      );
      for (const [number, fixture] of [[1, "eligible-ballot"], [2, "eligible-ballot-2"]] as const) {
        const fixtureDirectory = path.resolve("test/fixtures", fixture);
        const descriptorPath = path.join(directory, `descriptor-${number}.json`);
        await writeFile(descriptorPath, JSON.stringify({
          electionId,
          candidateListHash,
          circuitInputPath: path.join(fixtureDirectory, "input.json"),
          proofArtifactPath: path.join(fixtureDirectory, "eligible-ballot-proof-artifact.json"),
        }));
        await runScript("scripts/build_eligible_vote_package.ts", [
          descriptorPath,
          path.join(directory, `vote-${number}.json`),
        ]);
      }
      const firstPackage = JSON.parse(await readFile(
        path.join(directory, "vote-1.json"), "utf8",
      )) as { eligibilityRoot: string };
      const batchInputPath = path.join(directory, "batch-input.json");
      const batchArtifactPath = path.join(directory, "batch-v3.json");
      await writeFile(batchInputPath, JSON.stringify({
        electionId,
        eligibilityRoot: firstPackage.eligibilityRoot,
        previousNullifierRoot: zeroHash,
        packages: [
          { contentId: "ipfs://eligible-command-1", path: "vote-1.json" },
          { contentId: "ipfs://eligible-command-2", path: "vote-2.json" },
        ],
      }));
      await runScript("scripts/build_eligible_batch.ts", [batchInputPath, batchArtifactPath]);
      const batchArtifact = JSON.parse(await readFile(batchArtifactPath, "utf8")) as {
        manifest: { verificationMode: string; ballotProofPublicInputsHashes: string[] };
        recursiveProofSubmissionStatement: { implemented: boolean };
      };
      assert.equal(batchArtifact.manifest.verificationMode, "off-chain-real-proof-validation-v1");
      assert.equal(batchArtifact.manifest.ballotProofPublicInputsHashes.length, 2);
      assert.equal(batchArtifact.recursiveProofSubmissionStatement.implemented, false);

      const tallyInputPath = path.join(directory, "tally-input.json");
      const encryptedTallyPath = path.join(directory, "encrypted-tally-v3.json");
      await writeFile(tallyInputPath, JSON.stringify({
        electionId,
        candidateListHash,
        eligibilityRoot: firstPackage.eligibilityRoot,
        acceptedBatches: [{
          batchArtifactPath: "batch-v3.json",
          packages: [
            { contentId: "ipfs://eligible-command-1", path: "vote-1.json" },
            { contentId: "ipfs://eligible-command-2", path: "vote-2.json" },
          ],
        }],
      }));
      await runScript("scripts/build_eligible_tally.ts", [tallyInputPath, encryptedTallyPath]);

      const ceremonyConfigPath = path.join(directory, "ceremony.json");
      const ceremonyDirectory = path.join(directory, "ceremony");
      await writeFile(ceremonyConfigPath, JSON.stringify({
        threshold: 2,
        trusteeCount: 3,
        privateKey: "7",
        coefficients: ["11"],
      }));
      const ceremony = await runScript("scripts/create_threshold_ceremony.ts", [
        ceremonyConfigPath,
        ceremonyDirectory,
      ]);
      assert.equal(JSON.parse(ceremony.stdout).productionDkgImplemented, false);
      for (const trusteeIndex of [1, 2]) {
        await runScript("scripts/create_trustee_decryption_share.ts", [
          path.join(ceremonyDirectory, `trustee-${trusteeIndex}-private-share.json`),
          encryptedTallyPath,
          path.join(directory, `trustee-${trusteeIndex}-public-share.json`),
        ]);
      }
      const finalizeInputPath = path.join(directory, "finalize-input.json");
      const resultPath = path.join(directory, "tally-result-v3.json");
      await writeFile(finalizeInputPath, JSON.stringify({
        encryptedTallyPath: "encrypted-tally-v3.json",
        publicKeysetPath: "ceremony/threshold-public-keyset.json",
        decryptionShares: [
          { path: "trustee-1-public-share.json" },
          { path: "trustee-2-public-share.json" },
        ],
      }));
      await runScript("scripts/finalize_eligible_tally.ts", [finalizeInputPath, resultPath]);
      const result = JSON.parse(await readFile(resultPath, "utf8")) as {
        tallyCounts: number[];
        verificationStatus: string;
        onchainTallyProofImplemented: boolean;
      };
      assert.deepEqual(result.tallyCounts, [0, 1, 1, 0]);
      assert.equal(result.verificationStatus, "threshold-dleq-verified-off-chain");
      assert.equal(result.onchainTallyProofImplemented, false);

      const tamperedPath = path.join(directory, "trustee-1-tampered.json");
      const tampered = JSON.parse(await readFile(
        path.join(directory, "trustee-1-public-share.json"), "utf8",
      )) as { share: { proofs: { response: string }[] } };
      tampered.share.proofs[0]!.response = (BigInt(tampered.share.proofs[0]!.response) + 1n).toString();
      await writeFile(tamperedPath, JSON.stringify(tampered));
      await writeFile(finalizeInputPath, JSON.stringify({
        encryptedTallyPath: "encrypted-tally-v3.json",
        publicKeysetPath: "ceremony/threshold-public-keyset.json",
        decryptionShares: [
          { path: "trustee-1-tampered.json" },
          { path: "trustee-2-public-share.json" },
        ],
      }));
      await runScript(
        "scripts/finalize_eligible_tally.ts",
        [finalizeInputPath, resultPath],
        false,
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
