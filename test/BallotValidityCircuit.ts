import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

const wasmPath = path.resolve(
  "circuits/build/ballot_validity/ballot_validity_js/ballot_validity.wasm",
);
const fixtureInputPath = path.resolve(
  "test/fixtures/ballot-validity/input.json",
);

function calculateWitness(inputPath: string, witnessPath: string) {
  return spawnSync(
    "npx",
    ["snarkjs", "wtns", "calculate", wasmPath, inputPath, witnessPath],
    { cwd: process.cwd(), encoding: "utf8" },
  );
}

describe("ballot validity circuit constraints", function () {
  it("accepts a valid encrypted one-hot ballot witness", async function () {
    const directory = await mkdtemp(path.join(tmpdir(), "svb-ballot-circuit-valid-"));
    const result = calculateWitness(
      fixtureInputPath,
      path.join(directory, "valid.wtns"),
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
  });

  it("rejects a malformed selection that does not match the ciphertext", async function () {
    const directory = await mkdtemp(path.join(tmpdir(), "svb-ballot-circuit-invalid-"));
    const malformedInputPath = path.join(directory, "malformed-input.json");
    const input = JSON.parse(await readFile(fixtureInputPath, "utf8")) as {
      selection: string[];
    };
    input.selection = ["1", "1", "0", "0"];
    await writeFile(malformedInputPath, `${JSON.stringify(input, null, 2)}\n`);

    const result = calculateWitness(
      malformedInputPath,
      path.join(directory, "invalid.wtns"),
    );
    assert.notEqual(result.status, 0, "malformed ballot unexpectedly satisfied the circuit");
  });
});
