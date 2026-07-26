import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

const eligibleWasm = path.resolve(
  "circuits/build/eligible_ballot/eligible_ballot_js/eligible_ballot.wasm",
);
const eligibleFixture = path.resolve("test/fixtures/eligible-ballot/input.json");
const ballotWasm = path.resolve(
  "circuits/build/ballot_validity/ballot_validity_js/ballot_validity.wasm",
);
const ballotFixture = path.resolve("test/fixtures/ballot-validity/input.json");

function calcWitness(wasm: string, input: string, witness: string) {
  return spawnSync("npx", ["snarkjs", "wtns", "calculate", wasm, input, witness], {
    cwd: process.cwd(), encoding: "utf8",
  });
}

describe("adversarial — circuit negative tests", function () {
  it("rejects eligible-ballot with two candidates marked (one-hot violation)", async function () {
    const dir = await mkdtemp(path.join(tmpdir(), "svb-adv-oh-"));
    const input = JSON.parse(await readFile(eligibleFixture, "utf8")) as { selection: string[] };
    input.selection = ["1", "0", "1", "0"];
    const p = path.join(dir, "bad.json");
    await writeFile(p, `${JSON.stringify(input, null, 2)}\n`);
    const r = calcWitness(eligibleWasm, p, path.join(dir, "bad.wtns"));
    assert.notEqual(r.status, 0);
  });

  it("rejects eligible-ballot with all candidates zero", async function () {
    const dir = await mkdtemp(path.join(tmpdir(), "svb-adv-zero-"));
    const input = JSON.parse(await readFile(eligibleFixture, "utf8")) as { selection: string[] };
    input.selection = ["0", "0", "0", "0"];
    const p = path.join(dir, "bad.json");
    await writeFile(p, `${JSON.stringify(input, null, 2)}\n`);
    const r = calcWitness(eligibleWasm, p, path.join(dir, "bad.wtns"));
    assert.notEqual(r.status, 0);
  });

  it("rejects eligible-ballot with all candidates marked", async function () {
    const dir = await mkdtemp(path.join(tmpdir(), "svb-adv-all-"));
    const input = JSON.parse(await readFile(eligibleFixture, "utf8")) as { selection: string[] };
    input.selection = ["1", "1", "1", "1"];
    const p = path.join(dir, "bad.json");
    await writeFile(p, `${JSON.stringify(input, null, 2)}\n`);
    const r = calcWitness(eligibleWasm, p, path.join(dir, "bad.wtns"));
    assert.notEqual(r.status, 0);
  });

  it("rejects eligible-ballot with wrong electionId", async function () {
    const dir = await mkdtemp(path.join(tmpdir(), "svb-adv-eid-"));
    const input = JSON.parse(await readFile(eligibleFixture, "utf8")) as { electionId: string };
    input.electionId = (BigInt(input.electionId) + 1n).toString();
    const p = path.join(dir, "bad.json");
    await writeFile(p, `${JSON.stringify(input, null, 2)}\n`);
    const r = calcWitness(eligibleWasm, p, path.join(dir, "bad.wtns"));
    assert.notEqual(r.status, 0);
  });

  it("rejects eligible-ballot with tampered ciphertext", async function () {
    const dir = await mkdtemp(path.join(tmpdir(), "svb-adv-ct-"));
    const input = JSON.parse(await readFile(eligibleFixture, "utf8")) as { c1: string[][] };
    input.c1[0][0] = (BigInt(input.c1[0][0]) + 1n).toString();
    const p = path.join(dir, "bad.json");
    await writeFile(p, `${JSON.stringify(input, null, 2)}\n`);
    const r = calcWitness(eligibleWasm, p, path.join(dir, "bad.wtns"));
    assert.notEqual(r.status, 0);
  });

  it("rejects eligible-ballot with tampered package commitment", async function () {
    const dir = await mkdtemp(path.join(tmpdir(), "svb-adv-pc-"));
    const input = JSON.parse(await readFile(eligibleFixture, "utf8")) as { packageCommitment: string };
    input.packageCommitment = (BigInt(input.packageCommitment) + 1n).toString();
    const p = path.join(dir, "bad.json");
    await writeFile(p, `${JSON.stringify(input, null, 2)}\n`);
    const r = calcWitness(eligibleWasm, p, path.join(dir, "bad.wtns"));
    assert.notEqual(r.status, 0);
  });

  it("rejects ballot-validity with two candidates marked", async function () {
    const dir = await mkdtemp(path.join(tmpdir(), "svb-adv-boh-"));
    const input = JSON.parse(await readFile(ballotFixture, "utf8")) as { selection: string[] };
    input.selection = ["1", "1", "0", "0"];
    const p = path.join(dir, "bad.json");
    await writeFile(p, `${JSON.stringify(input, null, 2)}\n`);
    const r = calcWitness(ballotWasm, p, path.join(dir, "bad.wtns"));
    assert.notEqual(r.status, 0);
  });

  it("rejects ballot-validity with tampered candidate list hash", async function () {
    const dir = await mkdtemp(path.join(tmpdir(), "svb-adv-bcl-"));
    const input = JSON.parse(await readFile(ballotFixture, "utf8")) as { candidateListHash: string };
    input.candidateListHash = (BigInt(input.candidateListHash) + 1n).toString();
    const p = path.join(dir, "bad.json");
    await writeFile(p, `${JSON.stringify(input, null, 2)}\n`);
    const r = calcWitness(ballotWasm, p, path.join(dir, "bad.wtns"));
    assert.notEqual(r.status, 0);
  });
});
