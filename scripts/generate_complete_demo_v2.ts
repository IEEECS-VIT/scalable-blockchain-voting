import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { keccak256, stringToHex, zeroHash } from "viem";

type ProofArtifact = { publicSignals: readonly string[] };

const outputDirectory = path.resolve(process.argv[2] ?? "demo-output-v2");
await mkdir(outputDirectory, { recursive: true });

function run(script: string, ...args: string[]) {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", script, ...args],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${script} failed`);
  }
}

const electionId = keccak256(stringToHex("scalable-voting-demo-2026"));
const candidateListHash = keccak256(
  stringToHex("candidate-a,candidate-b,candidate-c,candidate-d"),
);
const fixtureNames = ["ballot-validity", "ballot-validity-2"] as const;
const packagePaths: string[] = [];

for (const [index, fixtureName] of fixtureNames.entries()) {
  const fixtureDirectory = path.resolve("test/fixtures", fixtureName);
  const proofArtifactPath = path.join(
    fixtureDirectory,
    "ballot-proof-artifact.json",
  );
  const proofArtifact = JSON.parse(
    await readFile(proofArtifactPath, "utf8"),
  ) as ProofArtifact;
  const descriptorPath = path.join(outputDirectory, `vote-${index + 1}-descriptor.json`);
  const packagePath = path.join(outputDirectory, `vote-${index + 1}-package-v2.json`);
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
  run(
    "scripts/build_proof_compatible_vote_package.ts",
    descriptorPath,
    packagePath,
  );
  packagePaths.push(packagePath);
}

const batchInputPath = path.join(outputDirectory, "batch-input-v2.json");
const batchArtifactPath = path.join(outputDirectory, "batch-artifact-v2.json");
const packageEntries = packagePaths.map((packagePath, index) => ({
  contentId: `ipfs://svb-real-proof-ballot-${index + 1}`,
  path: path.basename(packagePath),
}));
await writeFile(
  batchInputPath,
  `${JSON.stringify({
    electionId,
    previousNullifierRoot: zeroHash,
    packages: packageEntries,
  }, null, 2)}\n`,
);
run("scripts/build_proof_compatible_batch.ts", batchInputPath, batchArtifactPath);

const tallyInputPath = path.join(outputDirectory, "tally-input-v2.json");
const encryptedTallyPath = path.join(outputDirectory, "encrypted-tally-v2.json");
await writeFile(
  tallyInputPath,
  `${JSON.stringify({
    electionId,
    candidateListHash,
    acceptedBatches: [{
      batchArtifactPath: path.basename(batchArtifactPath),
      packages: packageEntries,
    }],
  }, null, 2)}\n`,
);
run("scripts/build_proof_compatible_tally.ts", tallyInputPath, encryptedTallyPath);

const finalizeConfigPath = path.join(outputDirectory, "threshold-demo-config.json");
const thresholdOutputDirectory = path.join(outputDirectory, "threshold-tally");
await writeFile(
  finalizeConfigPath,
  `${JSON.stringify({
    encryptedTallyPath: path.basename(encryptedTallyPath),
    threshold: 5,
    trusteeCount: 9,
    privateKey: "7",
    coefficients: ["11", "13", "17", "19"],
    maxVotes: 2,
    warning: "Deterministic local institution simulation; never use these values in production.",
  }, null, 2)}\n`,
);
run(
  "scripts/finalize_proof_compatible_tally.ts",
  finalizeConfigPath,
  thresholdOutputDirectory,
);

const batchArtifact = JSON.parse(await readFile(batchArtifactPath, "utf8")) as {
  manifest: {
    manifestDigest: string;
    aggregateCiphertextDigest: string;
    batchPublicInputsHash: string;
  };
};
const tallyResult = JSON.parse(
  await readFile(path.join(thresholdOutputDirectory, "tally-result-v2.json"), "utf8"),
) as {
  tallyCounts: number[];
  resultHash: string;
  tallyProofPublicInputsHash: string;
};
const summary = {
  generatedAt: new Date().toISOString(),
  mode: "zero-cost-local-cryptographic-demo",
  electionId,
  candidateListHash,
  ballotCount: 2,
  tallyCounts: tallyResult.tallyCounts,
  manifestDigest: batchArtifact.manifest.manifestDigest,
  aggregateCiphertextDigest: batchArtifact.manifest.aggregateCiphertextDigest,
  batchPublicInputsHash: batchArtifact.manifest.batchPublicInputsHash,
  resultHash: tallyResult.resultHash,
  tallyProofPublicInputsHash: tallyResult.tallyProofPublicInputsHash,
  capabilities: [
    { id: "ballotProof", label: "Real Groth16 ballot proofs", status: "real" },
    { id: "packages", label: "Proof-bound canonical vote packages", status: "real" },
    { id: "batchArtifacts", label: "Aggregate-bound batch and receipts", status: "real-offchain" },
    { id: "threshold", label: "5-of-9 threshold tally with DLEQ shares", status: "real-offchain" },
    { id: "batchProof", label: "On-chain batch-validity proof", status: "pending" },
    { id: "tallyProof", label: "On-chain tally SNARK", status: "pending" },
    { id: "anonAadhaar", label: "Anon Aadhaar test-mode proof", status: "external-pending" },
    { id: "erc4337", label: "Sponsored Amoy UserOperation", status: "external-pending" },
  ],
  trustBoundary:
    "Ballot proof is on-chain verifiable. Batch and threshold artifacts are cryptographically checked off-chain; batch/tally SNARKs and live external services remain gated.",
};
await writeFile(
  path.join(outputDirectory, "demo-summary.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
);

console.log(JSON.stringify({ outputDirectory, ...summary }, null, 2));
