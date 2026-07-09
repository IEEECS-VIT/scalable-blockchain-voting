import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { decodeFunctionData, keccak256, stringToHex } from "viem";

import { computeRegistrationPublicInputsHash } from "../packages/crypto/src/index.js";

const voterRegistryAbi = [
  {
    type: "function",
    name: "registerWithProof",
    inputs: [
      { name: "identityNullifier", type: "bytes32" },
      { name: "votingKey", type: "address" },
      { name: "proof", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

const electionId = keccak256(stringToHex("registration-relayer-election"));
const registryAddress = "0x1111111111111111111111111111111111111111";
const votingKey = "0x2222222222222222222222222222222222222222";
const identityNullifier = keccak256(stringToHex("registration-relayer-nullifier"));
const proof = "0x1234";

async function runScript(
  scriptPath: string,
  inputPath: string,
  extraArgs: readonly string[] = [],
  extraEnv: NodeJS.ProcessEnv = {},
) {
  const child = spawn(
    process.execPath,
    ["--import", "tsx", scriptPath, inputPath, ...extraArgs],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...extraEnv,
      },
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

describe("registration relayer request script", function () {
  it("builds calldata and public inputs for proof-based registration", async function () {
    const tempDir = await mkdtemp(join(tmpdir(), "svb-registration-request-"));
    try {
      const inputPath = join(tempDir, "registration-request.json");
      await writeFile(
        inputPath,
        JSON.stringify({
          electionId,
          registryAddress,
          identityNullifier,
          votingKey,
          proof,
        }),
        "utf8",
      );

      const result = await runScript("scripts/build_registration_request.ts", inputPath);
      assert.equal(result.exitCode, 0);
      assert.equal(result.stderr, "");
      const output = JSON.parse(result.stdout) as {
        publicInputsHash: string;
        relayerTransaction: {
          to: string;
          value: string;
          data: `0x${string}`;
        };
      };
      assert.equal(output.relayerTransaction.to, registryAddress);
      assert.equal(output.relayerTransaction.value, "0");
      assert.equal(
        output.publicInputsHash,
        computeRegistrationPublicInputsHash({
          electionId,
          identityNullifier,
          votingKey,
        }),
      );

      const decoded = decodeFunctionData({
        abi: voterRegistryAbi,
        data: output.relayerTransaction.data,
      });
      assert.equal(decoded.functionName, "registerWithProof");
      assert.deepEqual(decoded.args, [identityNullifier, votingKey, proof]);
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  it("rejects zero registry addresses before producing relayer calldata", async function () {
    const tempDir = await mkdtemp(join(tmpdir(), "svb-registration-request-invalid-"));
    try {
      const inputPath = join(tempDir, "registration-request.json");
      await writeFile(
        inputPath,
        JSON.stringify({
          electionId,
          registryAddress: "0x0000000000000000000000000000000000000000",
          identityNullifier,
          votingKey,
          proof,
        }),
        "utf8",
      );

      const result = await runScript("scripts/build_registration_request.ts", inputPath);
      assert.equal(result.exitCode, 1);
      assert.match(result.stderr, /registryAddress cannot be the zero address/);
      assert.equal(result.stdout, "");
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  it("dry-runs a relayer submission without requiring RPC credentials", async function () {
    const tempDir = await mkdtemp(join(tmpdir(), "svb-registration-submit-dry-"));
    try {
      const inputPath = join(tempDir, "registration-request.json");
      const artifactPath = join(tempDir, "registration-artifact.json");
      await writeFile(
        inputPath,
        JSON.stringify({
          electionId,
          registryAddress,
          identityNullifier,
          votingKey,
          proof,
        }),
        "utf8",
      );

      const buildResult = await runScript("scripts/build_registration_request.ts", inputPath);
      assert.equal(buildResult.exitCode, 0);
      await writeFile(artifactPath, buildResult.stdout, "utf8");

      const submitResult = await runScript(
        "scripts/submit_registration_relayer.ts",
        artifactPath,
        ["--dry-run"],
        {
          RELAYER_PRIVATE_KEY: "",
          RELAYER_RPC_URL: "",
          AMOY_RPC_URL: "",
        },
      );
      assert.equal(submitResult.exitCode, 0);
      assert.equal(submitResult.stderr, "");
      const output = JSON.parse(submitResult.stdout) as {
        dryRun: boolean;
        submitted: boolean;
        relayerAddress: string | null;
        transaction: {
          to: string;
          value: string;
          data: string;
        };
      };
      assert.equal(output.dryRun, true);
      assert.equal(output.submitted, false);
      assert.equal(output.relayerAddress, null);
      assert.equal(output.transaction.to, registryAddress);
      assert.equal(output.transaction.value, "0");
      assert.match(output.transaction.data, /^0x[0-9a-f]+$/);
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  it("refuses live relayer submission without a relayer private key", async function () {
    const tempDir = await mkdtemp(join(tmpdir(), "svb-registration-submit-live-"));
    try {
      const artifactPath = join(tempDir, "registration-artifact.json");
      await writeFile(
        artifactPath,
        JSON.stringify({
          publicInputsHash: computeRegistrationPublicInputsHash({
            electionId,
            identityNullifier,
            votingKey,
          }),
          relayerTransaction: {
            to: registryAddress,
            value: "0",
            data: "0x1234",
          },
        }),
        "utf8",
      );

      const submitResult = await runScript(
        "scripts/submit_registration_relayer.ts",
        artifactPath,
        [],
        {
          RELAYER_PRIVATE_KEY: "",
          RELAYER_RPC_URL: "",
          AMOY_RPC_URL: "",
        },
      );
      assert.equal(submitResult.exitCode, 1);
      assert.match(submitResult.stderr, /RELAYER_PRIVATE_KEY is required/);
      assert.equal(submitResult.stdout, "");
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });
});
