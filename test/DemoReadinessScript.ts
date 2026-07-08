import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

const validAddress = "0x1111111111111111111111111111111111111111";
const validHash = `0x${"ab".repeat(32)}`;

async function runReadiness(inputPath: string, allowBlocked = false) {
  const args = ["--import", "tsx", "scripts/check_demo_readiness.ts", inputPath];
  if (allowBlocked) args.push("--allow-blocked");
  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
  });
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

describe("demo readiness script", function () {
  it("fails when final-demo proof artifacts are missing or mocked", async function () {
    const tempDir = await mkdtemp(join(tmpdir(), "svb-readiness-blocked-"));
    try {
      const inputPath = join(tempDir, "readiness.json");
      await writeFile(
        inputPath,
        JSON.stringify({
          eligibility: {
            mock: true,
            verifierAddress: validAddress,
          },
          frontend: {
            pages: ["registration"],
          },
        }),
        "utf8",
      );

      const failed = await runReadiness(inputPath);
      assert.equal(failed.exitCode, 1);
      assert.equal(failed.stderr, "");
      const failedOutput = JSON.parse(failed.stdout) as {
        ready: boolean;
        checks: Array<{ id: string; ready: boolean; blockers: string[] }>;
      };
      assert.equal(failedOutput.ready, false);
      assert.equal(
        failedOutput.checks.find((check) => check.id === "eligibility")?.ready,
        false,
      );
      assert.equal(
        failedOutput.checks.find((check) => check.id === "batchValidity")?.blockers.includes(
          "artifact section is missing",
        ),
        true,
      );

      const allowed = await runReadiness(inputPath, true);
      assert.equal(allowed.exitCode, 0);
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  it("passes when required proof, sponsorship, and frontend artifacts are present", async function () {
    const tempDir = await mkdtemp(join(tmpdir(), "svb-readiness-ready-"));
    try {
      await mkdir(join(tempDir, "artifacts"));
      const artifactPaths = [
        "artifacts/ballot.circom",
        "artifacts/ballot.wasm",
        "artifacts/ballot.zkey",
        "artifacts/ballot.vkey.json",
        "artifacts/batch.circom",
        "artifacts/batch.wasm",
        "artifacts/batch.zkey",
        "artifacts/batch.vkey.json",
        "artifacts/tally.circom",
        "artifacts/tally.wasm",
        "artifacts/tally.zkey",
        "artifacts/tally.vkey.json",
      ];
      await Promise.all(artifactPaths.map((path) =>
        writeFile(join(tempDir, path), "demo artifact", "utf8"),
      ));
      const proofArtifact = (prefix: "ballot" | "batch" | "tally") => ({
        mock: false,
        verifierAddress: validAddress,
        circuitPath: `artifacts/${prefix}.circom`,
        wasmPath: `artifacts/${prefix}.wasm`,
        zkeyPath: `artifacts/${prefix}.zkey`,
        verificationKeyPath: `artifacts/${prefix}.vkey.json`,
      });
      const inputPath = join(tempDir, "readiness.json");
      await writeFile(
        inputPath,
        JSON.stringify({
          eligibility: {
            mock: false,
            verifierAddress: validAddress,
          },
          ballotValidity: proofArtifact("ballot"),
          batchValidity: proofArtifact("batch"),
          tallyProof: proofArtifact("tally"),
          sponsoredUserOperation: {
            mock: false,
            paymasterAddress: validAddress,
            userOperationHash: validHash,
            transactionHash: validHash,
          },
          frontend: {
            mock: false,
            pages: [
              "registration",
              "voting",
              "receipt",
              "batch",
              "tally",
              "verification",
            ],
          },
        }),
        "utf8",
      );

      const result = await runReadiness(inputPath);
      assert.equal(result.exitCode, 0);
      assert.equal(result.stderr, "");
      const output = JSON.parse(result.stdout) as {
        ready: boolean;
        checks: Array<{ ready: boolean }>;
      };
      assert.equal(output.ready, true);
      assert.equal(output.checks.every((check) => check.ready), true);
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });
});
