import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { keccak256, stringToHex, zeroHash } from "viem";

import {
  BALLOT_PROOF_SYSTEM,
  VOTE_PACKAGE_VERSION,
  computeBallotPublicInputsHash,
  createElectionKeyPair,
  encryptBallotSelection,
  serializeVotePackage,
  type VotePackageV1,
} from "../packages/crypto/src/index.js";

const hash = (value: string) => keccak256(stringToHex(value));
const electionId = hash("batch-script-election");
const candidateListHash = hash("candidate-list");
const electionKey = createElectionKeyPair(
  "0x0000000000000000000000000000000000000000000000000000000000000001",
);

function votePackage(label: string, selectedIndex: number): VotePackageV1 {
  const ballotNullifier = hash(`batch-script-nullifier-${label}`);
  const ciphertext = encryptBallotSelection({
    electionPublicKey: electionKey.publicKey,
    candidateCount: 3,
    selectedIndex,
    randomness: [
      "0x0000000000000000000000000000000000000000000000000000000000000011",
      "0x0000000000000000000000000000000000000000000000000000000000000012",
      "0x0000000000000000000000000000000000000000000000000000000000000013",
    ],
  });

  return {
    version: VOTE_PACKAGE_VERSION,
    electionId,
    candidateListHash,
    ballotNullifier,
    ciphertext,
    ballotValidityProof: {
      system: BALLOT_PROOF_SYSTEM,
      proof: "0x1234",
      publicInputsHash: computeBallotPublicInputsHash({
        electionId,
        candidateListHash,
        ballotNullifier,
        ciphertext,
      }),
    },
  };
}

describe("batch manifest script", function () {
  it("builds submitBatch args and inclusion receipts from package files", async function () {
    const tempDir = await mkdtemp(join(tmpdir(), "svb-batch-test-"));
    try {
      await writeFile(
        join(tempDir, "vote-a.json"),
        serializeVotePackage(votePackage("a", 0)),
        "utf8",
      );
      await writeFile(
        join(tempDir, "vote-b.json"),
        serializeVotePackage(votePackage("b", 2)),
        "utf8",
      );
      const inputPath = join(tempDir, "batch-input.json");
      await writeFile(
        inputPath,
        JSON.stringify({
          electionId,
          previousNullifierRoot: zeroHash,
          packages: [
            { contentId: "ipfs://bafy-demo-a", path: "vote-a.json" },
            { contentId: "ipfs://bafy-demo-b", path: "vote-b.json" },
          ],
        }),
        "utf8",
      );

      const child = spawn(
        process.execPath,
        ["--import", "tsx", "scripts/build_batch_manifest.ts", inputPath],
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
      assert.equal(Buffer.concat(stderrChunks).toString(), "");
      assert.equal(exitCode, 0);

      const output = JSON.parse(Buffer.concat(stdoutChunks).toString()) as {
        manifest: { batchSize: string; manifestDigest: string };
        submitBatchArgs: readonly unknown[];
        receipts: readonly { contentId: string; proof: readonly unknown[] }[];
      };

      assert.equal(output.manifest.batchSize, "2");
      assert.match(output.manifest.manifestDigest, /^0x[0-9a-f]{64}$/);
      assert.equal(output.submitBatchArgs.length, 5);
      assert.equal(output.submitBatchArgs[4], "2");
      assert.deepEqual(
        output.receipts.map((receipt) => receipt.contentId).sort(),
        ["ipfs://bafy-demo-a", "ipfs://bafy-demo-b"],
      );
      assert.equal(output.receipts.every((receipt) => receipt.proof.length > 0), true);
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });
});
