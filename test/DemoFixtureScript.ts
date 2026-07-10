import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

async function runScript(scriptPath: string, args: readonly string[]) {
  const child = spawn(
    process.execPath,
    ["--import", "tsx", scriptPath, ...args],
    {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
  child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

  const [exitCode] = await once(child, "close") as [number];
  return {
    exitCode,
    stdout: Buffer.concat(stdoutChunks).toString(),
    stderr: Buffer.concat(stderrChunks).toString(),
  };
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

describe("demo fixture generator", function () {
  it("generates a deterministic local pipeline fixture", async function () {
    const tempDir = await mkdtemp(join(tmpdir(), "svb-demo-fixture-"));
    try {
      const result = await runScript("scripts/generate_demo_fixture.ts", [tempDir]);
      assert.equal(result.exitCode, 0);
      assert.equal(result.stderr, "");
      const summary = JSON.parse(result.stdout) as {
        outputDir: string;
        ballotCount: number;
        tallyCounts: readonly number[];
        batchPublicInputsHash: string;
        tallyProofPublicInputsHash: string;
        resultHash: string;
      };
      assert.equal(summary.outputDir, tempDir);
      assert.equal(summary.ballotCount, 3);
      assert.deepEqual(summary.tallyCounts, [1, 1, 1]);
      assert.match(summary.batchPublicInputsHash, /^0x[0-9a-f]{64}$/);
      assert.match(summary.tallyProofPublicInputsHash, /^0x[0-9a-f]{64}$/);
      assert.match(summary.resultHash, /^0x[0-9a-f]{64}$/);

      const readme = await readJson<{
        warning: string;
        expectedTallyCounts: readonly number[];
        files: readonly string[];
      }>(join(tempDir, "README.json"));
      assert.match(readme.warning, /not a SNARK proof/);
      assert.deepEqual(readme.expectedTallyCounts, [1, 1, 1]);
      for (const fileName of readme.files) {
        assert.notEqual(await readFile(join(tempDir, fileName), "utf8"), "");
      }

      const batchArtifact = await readJson<{
        manifest: {
          batchSize: string;
          batchPublicInputsHash: string;
        };
        submitBatchWithProofArgsPrefix: readonly unknown[];
      }>(join(tempDir, "batch-artifact.json"));
      assert.equal(batchArtifact.manifest.batchSize, "3");
      assert.equal(
        batchArtifact.submitBatchWithProofArgsPrefix[4],
        batchArtifact.manifest.batchPublicInputsHash,
      );

      const tallyResult = await readJson<{
        tallyCounts: readonly number[];
        tallyVerifierPublishArgs: {
          resultHash: string;
          publicInputsHash: string;
        };
        resultHash: string;
        tallyProofPublicInputsHash: string;
      }>(join(tempDir, "tally-result-artifact.json"));
      assert.deepEqual(tallyResult.tallyCounts, [1, 1, 1]);
      assert.equal(
        tallyResult.tallyVerifierPublishArgs.resultHash,
        tallyResult.resultHash,
      );
      assert.equal(
        tallyResult.tallyVerifierPublishArgs.publicInputsHash,
        tallyResult.tallyProofPublicInputsHash,
      );

      const rebuiltTally = await runScript("scripts/build_tally_input.ts", [
        join(tempDir, "tally-input.json"),
      ]);
      assert.equal(rebuiltTally.exitCode, 0);
      assert.equal(rebuiltTally.stderr, "");
      const rebuiltTallyOutput = JSON.parse(rebuiltTally.stdout) as {
        encryptedTallyPublicInputsHash: string;
      };
      const tallyArtifact = await readJson<{
        encryptedTallyPublicInputsHash: string;
      }>(join(tempDir, "tally-artifact.json"));
      assert.equal(
        rebuiltTallyOutput.encryptedTallyPublicInputsHash,
        tallyArtifact.encryptedTallyPublicInputsHash,
      );

      const rebuiltResult = await runScript("scripts/build_tally_result.ts", [
        join(tempDir, "tally-result-input.json"),
      ]);
      assert.equal(rebuiltResult.exitCode, 0);
      assert.equal(rebuiltResult.stderr, "");
      const rebuiltResultOutput = JSON.parse(rebuiltResult.stdout) as {
        tallyCounts: readonly number[];
        resultHash: string;
      };
      assert.deepEqual(rebuiltResultOutput.tallyCounts, [1, 1, 1]);
      assert.equal(rebuiltResultOutput.resultHash, tallyResult.resultHash);
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });
});
