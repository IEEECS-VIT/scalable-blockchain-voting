import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

const wasmPath = path.resolve(
  "circuits/build/eligible_ballot/eligible_ballot_js/eligible_ballot.wasm",
);
const fixtureInputPath = path.resolve("test/fixtures/eligible-ballot/input.json");

function calculateWitness(inputPath: string, witnessPath: string) {
  return spawnSync("npx", ["snarkjs", "wtns", "calculate", wasmPath, inputPath, witnessPath], {
    cwd: process.cwd(), encoding: "utf8",
  });
}

describe("unified eligibility and ballot circuit", function () {
  it("accepts a private eligibility membership and valid encrypted ballot", async function () {
    const directory = await mkdtemp(path.join(tmpdir(), "svb-eligible-valid-"));
    const result = calculateWitness(fixtureInputPath, path.join(directory, "valid.wtns"));
    assert.equal(result.status, 0, result.stderr || result.stdout);
  });

  it("rejects a changed eligibility path", async function () {
    const directory = await mkdtemp(path.join(tmpdir(), "svb-eligible-path-"));
    const input = JSON.parse(await readFile(fixtureInputPath, "utf8")) as {
      eligibilityPathElements: string[];
    };
    input.eligibilityPathElements[0] = (BigInt(input.eligibilityPathElements[0]!) + 1n).toString();
    const inputPath = path.join(directory, "invalid.json");
    await writeFile(inputPath, `${JSON.stringify(input, null, 2)}\n`);
    const result = calculateWitness(inputPath, path.join(directory, "invalid.wtns"));
    assert.notEqual(result.status, 0);
  });

  it("rejects a nullifier not derived from the private credential", async function () {
    const directory = await mkdtemp(path.join(tmpdir(), "svb-eligible-nullifier-"));
    const input = JSON.parse(await readFile(fixtureInputPath, "utf8")) as {
      ballotNullifier: string;
    };
    input.ballotNullifier = (BigInt(input.ballotNullifier) + 1n).toString();
    const inputPath = path.join(directory, "invalid.json");
    await writeFile(inputPath, `${JSON.stringify(input, null, 2)}\n`);
    const result = calculateWitness(inputPath, path.join(directory, "invalid.wtns"));
    assert.notEqual(result.status, 0);
  });
});
