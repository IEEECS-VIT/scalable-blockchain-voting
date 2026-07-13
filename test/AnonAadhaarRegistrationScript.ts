import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { after, before, describe, it } from "node:test";

import {
  encodeAbiParameters,
  encodePacked,
  keccak256,
  parseAbiParameters,
  stringToHex,
  type Hex,
} from "viem";

import { bytes32ToSnarkField } from "../packages/crypto/src/proofCompatibleBallot.js";

describe("Anon Aadhaar registration artifact builder", function () {
  let directory: string;
  const electionId = keccak256(stringToHex("anon-registration-test-election"));
  const identityNullifier = `0x${123n.toString(16).padStart(64, "0")}` as Hex;
  const registryAddress = "0x1111111111111111111111111111111111111111";
  const votingKey = "0x2222222222222222222222222222222222222222";

  before(async function () {
    directory = await mkdtemp(path.join(tmpdir(), "svb-anon-registration-"));
  });

  after(async function () {
    await rm(directory, { recursive: true, force: true });
  });

  async function writeInputs(signalHashOverride?: string) {
    const domain = keccak256(
      new TextEncoder().encode("SVB_ANON_AADHAAR_REGISTRATION_SIGNAL_V1"),
    );
    const signal = BigInt(keccak256(encodeAbiParameters(
      parseAbiParameters(
        "bytes32 domain, bytes32 electionId, bytes32 identityNullifier, address votingKey",
      ),
      [domain, electionId, identityNullifier, votingKey],
    )));
    const signalHash = BigInt(keccak256(
      encodePacked(["uint256"], [signal]),
    )) >> 3n;
    await writeFile(path.join(directory, "proof.json"), JSON.stringify({
      groth16Proof: {
        pi_a: ["1", "2", "1"],
        pi_b: [["3", "4"], ["5", "6"], ["1", "0"]],
        pi_c: ["7", "8", "1"],
      },
      timestamp: "1900000000",
      nullifierSeed: bytes32ToSnarkField(electionId).toString(),
      nullifier: "123",
      signalHash: signalHashOverride ?? signalHash.toString(),
    }));
    await writeFile(path.join(directory, "descriptor.json"), JSON.stringify({
      registryAddress,
      electionId,
      identityNullifier,
      votingKey,
      anonAadhaarProofPath: "proof.json",
    }));
  }

  it("builds non-mock relayer calldata only for correctly bound public signals", async function () {
    await writeInputs();
    const outputPath = path.join(directory, "artifact.json");
    const result = spawnSync(process.execPath, [
      "--import", "tsx", "scripts/build_anon_aadhaar_registration.ts",
      path.join(directory, "descriptor.json"), outputPath,
    ], { cwd: process.cwd(), encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const artifact = JSON.parse(await readFile(outputPath, "utf8"));
    assert.equal(artifact.mock, false);
    assert.equal(artifact.electionId, electionId);
    assert.equal(artifact.transaction.to, registryAddress);
    assert.match(artifact.transaction.data, /^0x[0-9a-f]+$/);
  });

  it("rejects a proof signal that does not authorize this registration", async function () {
    await writeInputs("1");
    const result = spawnSync(process.execPath, [
      "--import", "tsx", "scripts/build_anon_aadhaar_registration.ts",
      path.join(directory, "descriptor.json"), path.join(directory, "bad.json"),
    ], { cwd: process.cwd(), encoding: "utf8" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /does not bind this registration/);
  });
});
