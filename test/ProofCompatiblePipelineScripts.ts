import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { keccak256, stringToHex, zeroHash } from "viem";

type ProofArtifact = {
  publicSignals: readonly string[];
};

function runScript(script: string, ...args: string[]) {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", script, ...args],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

describe("proof-compatible pipeline scripts", function () {
  it("builds real-proof packages, an aggregate-bound batch, and a tally", async function () {
    const directory = await mkdtemp(path.join(tmpdir(), "svb-proof-pipeline-"));
    const electionId = keccak256(stringToHex("scalable-voting-demo-2026"));
    const candidateListHash = keccak256(
      stringToHex("candidate-a,candidate-b,candidate-c,candidate-d"),
    );
    const fixtures = ["ballot-validity", "ballot-validity-2"] as const;
    const packagePaths: string[] = [];

    for (const [index, fixture] of fixtures.entries()) {
      const fixtureDirectory = path.resolve("test/fixtures", fixture);
      const proofArtifactPath = path.join(
        fixtureDirectory,
        "ballot-proof-artifact.json",
      );
      const proofArtifact = JSON.parse(
        await readFile(proofArtifactPath, "utf8"),
      ) as ProofArtifact;
      const descriptorPath = path.join(directory, `descriptor-${index}.json`);
      const packagePath = path.join(directory, `vote-package-${index}.json`);
      await writeFile(
        descriptorPath,
        `${JSON.stringify({
          electionId,
          candidateListHash,
          ballotNullifier:
            `0x${BigInt(proofArtifact.publicSignals[2]!).toString(16).padStart(64, "0")}`,
          circuitInputPath: path.join(fixtureDirectory, "input.json"),
          proofArtifactPath,
        }, null, 2)}\n`,
      );
      runScript(
        "scripts/build_proof_compatible_vote_package.ts",
        descriptorPath,
        packagePath,
      );
      packagePaths.push(packagePath);
    }

    const batchInputPath = path.join(directory, "batch-input.json");
    const batchArtifactPath = path.join(directory, "batch-artifact.json");
    await writeFile(
      batchInputPath,
      `${JSON.stringify({
        electionId,
        previousNullifierRoot: zeroHash,
        packages: packagePaths.map((packagePath, index) => ({
          contentId: `ipfs://proof-compatible-${index}`,
          path: path.basename(packagePath),
        })),
      }, null, 2)}\n`,
    );
    runScript(
      "scripts/build_proof_compatible_batch.ts",
      batchInputPath,
      batchArtifactPath,
    );

    const tallyInputPath = path.join(directory, "tally-input.json");
    const tallyArtifactPath = path.join(directory, "tally-artifact.json");
    await writeFile(
      tallyInputPath,
      `${JSON.stringify({
        electionId,
        candidateListHash,
        privateKey: "7",
        maxVotes: 2,
        acceptedBatches: [{
          batchArtifactPath: path.basename(batchArtifactPath),
          packages: packagePaths.map((packagePath, index) => ({
            contentId: `ipfs://proof-compatible-${index}`,
            path: path.basename(packagePath),
          })),
        }],
      }, null, 2)}\n`,
    );
    runScript(
      "scripts/build_proof_compatible_tally.ts",
      tallyInputPath,
      tallyArtifactPath,
    );

    const batchArtifact = JSON.parse(
      await readFile(batchArtifactPath, "utf8"),
    ) as { manifest: { version: number; aggregateCiphertextDigest: string } };
    const tallyArtifact = JSON.parse(
      await readFile(tallyArtifactPath, "utf8"),
    ) as { version: number; ballotCount: number; tallyCounts: number[] };
    assert.equal(batchArtifact.manifest.version, 2);
    assert.match(batchArtifact.manifest.aggregateCiphertextDigest, /^0x[0-9a-f]{64}$/);
    assert.equal(tallyArtifact.version, 2);
    assert.equal(tallyArtifact.ballotCount, 2);
    assert.deepEqual(tallyArtifact.tallyCounts, [0, 1, 1, 0]);

    const finalizeConfigPath = path.join(directory, "finalize-config.json");
    const finalOutputDirectory = path.join(directory, "threshold-result");
    await writeFile(
      finalizeConfigPath,
      `${JSON.stringify({
        encryptedTallyPath: path.basename(tallyArtifactPath),
        threshold: 5,
        trusteeCount: 9,
        privateKey: "7",
        coefficients: ["11", "13", "17", "19"],
        maxVotes: 2,
      }, null, 2)}\n`,
    );
    runScript(
      "scripts/finalize_proof_compatible_tally.ts",
      finalizeConfigPath,
      finalOutputDirectory,
    );
    const finalResult = JSON.parse(
      await readFile(path.join(finalOutputDirectory, "tally-result-v2.json"), "utf8"),
    ) as { tallyCounts: number[]; threshold: number; decryptionShareDigests: string[] };
    assert.deepEqual(finalResult.tallyCounts, [0, 1, 1, 0]);
    assert.equal(finalResult.threshold, 5);
    assert.equal(finalResult.decryptionShareDigests.length, 5);
  });
});
