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
  createTallyDecryptionShare,
  createElectionKeyPair,
  createThresholdElectionKeyShares,
  decryptAggregatedTally,
  encryptBallotSelection,
  serializeVotePackage,
  type BallotCiphertextV1,
  type TallyDecryptionShareV1,
  type VotePackageV1,
} from "../packages/crypto/src/index.js";

const hash = (value: string) => keccak256(stringToHex(value));
const privateKey = "0x0000000000000000000000000000000000000000000000000000000000000001";
const electionId = hash("tally-script-election");
const candidateListHash = hash("candidate-list");
const electionKey = createElectionKeyPair(privateKey);

function votePackage(label: string, selectedIndex: number): VotePackageV1 {
  const ballotNullifier = hash(`tally-script-nullifier-${label}`);
  const ciphertext = encryptBallotSelection({
    electionPublicKey: electionKey.publicKey,
    candidateCount: 3,
    selectedIndex,
    randomness: [
      `0x${(17n + BigInt(label.charCodeAt(0))).toString(16).padStart(64, "0")}`,
      `0x${(18n + BigInt(label.charCodeAt(0))).toString(16).padStart(64, "0")}`,
      `0x${(19n + BigInt(label.charCodeAt(0))).toString(16).padStart(64, "0")}`,
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

async function runScript(scriptPath: string, inputPath: string) {
  const child = spawn(
    process.execPath,
    ["--import", "tsx", scriptPath, inputPath],
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
  return JSON.parse(Buffer.concat(stdoutChunks).toString()) as unknown;
}

describe("tally aggregation script", function () {
  it("aggregates ciphertexts only from an accepted batch artifact", async function () {
    const tempDir = await mkdtemp(join(tmpdir(), "svb-tally-test-"));
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
      const batchInputPath = join(tempDir, "batch-input.json");
      await writeFile(
        batchInputPath,
        JSON.stringify({
          electionId,
          previousNullifierRoot: zeroHash,
          packages: [
            { contentId: "ipfs://bafy-tally-a", path: "vote-a.json" },
            { contentId: "ipfs://bafy-tally-b", path: "vote-b.json" },
          ],
        }),
        "utf8",
      );

      const batchArtifact = await runScript(
        "scripts/build_batch_manifest.ts",
        batchInputPath,
      );
      await writeFile(
        join(tempDir, "batch-artifact.json"),
        JSON.stringify(batchArtifact),
        "utf8",
      );

      const tallyInputPath = join(tempDir, "tally-input.json");
      await writeFile(
        tallyInputPath,
        JSON.stringify({
          electionId,
          candidateListHash,
          acceptedBatches: [{
            batchArtifactPath: "batch-artifact.json",
            packages: [
              { contentId: "ipfs://bafy-tally-a", path: "vote-a.json" },
              { contentId: "ipfs://bafy-tally-b", path: "vote-b.json" },
            ],
          }],
        }),
        "utf8",
      );

      const tallyOutput = await runScript(
        "scripts/build_tally_input.ts",
        tallyInputPath,
      ) as {
        ballotCount: number;
        aggregateCiphertext: BallotCiphertextV1;
        aggregateCiphertextDigest: string;
        acceptedBatchManifestDigests: readonly string[];
        acceptedBatchPublicInputsHashes: readonly string[];
        encryptedTallyPublicInputsHash: string;
      };

      assert.equal(tallyOutput.ballotCount, 2);
      assert.match(tallyOutput.aggregateCiphertextDigest, /^0x[0-9a-f]{64}$/);
      assert.match(tallyOutput.encryptedTallyPublicInputsHash, /^0x[0-9a-f]{64}$/);
      assert.deepEqual(
        decryptAggregatedTally({
          privateKey,
          ciphertext: tallyOutput.aggregateCiphertext,
          maxVotes: 2,
        }),
        [1, 0, 1],
      );

      await writeFile(
        join(tempDir, "tally-artifact.json"),
        JSON.stringify(tallyOutput),
        "utf8",
      );
      const thresholdKey = createThresholdElectionKeyShares({
        privateKey,
        threshold: 2,
        trusteeCount: 3,
        coefficients: [
          "0x000000000000000000000000000000000000000000000000000000000000001d",
        ],
      });
      const shareFiles = thresholdKey.shares.slice(0, 2).map((share, index) => {
        const decryptionShare = createTallyDecryptionShare({
          trusteeIndex: share.trusteeIndex,
          privateShare: share.privateShare,
          ciphertext: tallyOutput.aggregateCiphertext,
          proofNonces: [
            `0x${(41n + BigInt(index)).toString(16).padStart(64, "0")}`,
            `0x${(42n + BigInt(index)).toString(16).padStart(64, "0")}`,
            `0x${(43n + BigInt(index)).toString(16).padStart(64, "0")}`,
          ],
        });
        return {
          path: `share-${share.trusteeIndex}.json`,
          decryptionShare,
        };
      });
      await Promise.all(shareFiles.map((entry) =>
        writeFile(
          join(tempDir, entry.path),
          JSON.stringify(entry.decryptionShare satisfies TallyDecryptionShareV1),
          "utf8",
        ),
      ));
      const tallyResultInputPath = join(tempDir, "tally-result-input.json");
      await writeFile(
        tallyResultInputPath,
        JSON.stringify({
          tallyArtifactPath: "tally-artifact.json",
          threshold: 2,
          decryptionShares: shareFiles.map((entry) => ({ path: entry.path })),
        }),
        "utf8",
      );

      const tallyResult = await runScript(
        "scripts/build_tally_result.ts",
        tallyResultInputPath,
      ) as {
        tallyCounts: readonly number[];
        resultHash: string;
        tallyProofPublicInputsHash: string;
        decryptionShareDigests: readonly string[];
        tallyVerifierPublishArgs: {
          resultHash: string;
          publicInputsHash: string;
        };
      };

      assert.deepEqual(tallyResult.tallyCounts, [1, 0, 1]);
      assert.equal(tallyResult.decryptionShareDigests.length, 2);
      assert.match(tallyResult.resultHash, /^0x[0-9a-f]{64}$/);
      assert.match(tallyResult.tallyProofPublicInputsHash, /^0x[0-9a-f]{64}$/);
      assert.equal(tallyResult.tallyVerifierPublishArgs.resultHash, tallyResult.resultHash);
      assert.equal(tallyResult.tallyVerifierPublishArgs.publicInputsHash, tallyResult.tallyProofPublicInputsHash);
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });
});
