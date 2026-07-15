import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { keccak256, stringToHex, zeroHash } from "viem";

const outputDirectory = path.resolve(process.argv[2] ?? "demo-output-v3");
await mkdir(outputDirectory, { recursive: true });

function run(script: string, ...args: string[]) {
  const result = spawnSync(process.execPath, ["--import", "tsx", script, ...args], {
    cwd: process.cwd(), encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${script} failed`);
  }
}

const electionId = keccak256(stringToHex("scalable-voting-demo-2026"));
const candidateListHash = keccak256(
  stringToHex("candidate-a,candidate-b,candidate-c,candidate-d"),
);
const fixtureNames = ["eligible-ballot", "eligible-ballot-2"] as const;
const packagePaths: string[] = [];

for (const [index, fixtureName] of fixtureNames.entries()) {
  const fixtureDirectory = path.resolve("test/fixtures", fixtureName);
  const descriptorPath = path.join(outputDirectory, `vote-${index + 1}-descriptor-v3.json`);
  const packagePath = path.join(outputDirectory, `vote-${index + 1}-package-v3.json`);
  await writeFile(descriptorPath, `${JSON.stringify({
    electionId,
    candidateListHash,
    circuitInputPath: path.join(fixtureDirectory, "input.json"),
    proofArtifactPath: path.join(fixtureDirectory, "eligible-ballot-proof-artifact.json"),
  }, null, 2)}\n`);
  run("scripts/build_eligible_vote_package.ts", descriptorPath, packagePath);
  packagePaths.push(packagePath);
}
const firstPackage = JSON.parse(await readFile(packagePaths[0]!, "utf8")) as {
  eligibilityRoot: string;
};
const packageEntries = packagePaths.map((packagePath, index) => ({
  contentId: `ipfs://svb-unified-proof-ballot-${index + 1}`,
  path: path.basename(packagePath),
}));

const batchInputPath = path.join(outputDirectory, "batch-input-v3.json");
const batchArtifactPath = path.join(outputDirectory, "batch-artifact-v3.json");
await writeFile(batchInputPath, `${JSON.stringify({
  electionId,
  eligibilityRoot: firstPackage.eligibilityRoot,
  previousNullifierRoot: zeroHash,
  packages: packageEntries,
}, null, 2)}\n`);
run("scripts/build_eligible_batch.ts", batchInputPath, batchArtifactPath);

const tallyInputPath = path.join(outputDirectory, "tally-input-v3.json");
const encryptedTallyPath = path.join(outputDirectory, "encrypted-tally-v3.json");
await writeFile(tallyInputPath, `${JSON.stringify({
  electionId,
  candidateListHash,
  eligibilityRoot: firstPackage.eligibilityRoot,
  acceptedBatches: [{
    batchArtifactPath: path.basename(batchArtifactPath),
    packages: packageEntries,
  }],
}, null, 2)}\n`);
run("scripts/build_eligible_tally.ts", tallyInputPath, encryptedTallyPath);

const privateCeremonyWorkspace = await mkdtemp(path.join(tmpdir(), "svb-v3-ceremony-"));
const finalizeInputPath = path.join(outputDirectory, "finalize-tally-input-v3.json");
const tallyResultPath = path.join(outputDirectory, "tally-result-v3.json");
try {
  const ceremonyConfigPath = path.join(privateCeremonyWorkspace, "threshold-ceremony-config.json");
  const ceremonyDirectory = path.join(privateCeremonyWorkspace, "trustee-private-files");
  await writeFile(ceremonyConfigPath, `${JSON.stringify({
    threshold: 5,
    trusteeCount: 9,
    privateKey: "7",
    coefficients: ["11", "13", "17", "19"],
    warning: "Deterministic demo dealer inputs. Never use these values in production.",
  }, null, 2)}\n`);
  run("scripts/create_threshold_ceremony.ts", ceremonyConfigPath, ceremonyDirectory);
  const publicKeysetPath = path.join(outputDirectory, "threshold-public-keyset-v3.json");
  await writeFile(
    publicKeysetPath,
    await readFile(path.join(ceremonyDirectory, "threshold-public-keyset.json")),
  );

  const publicShareEntries: { path: string }[] = [];
  for (let trusteeIndex = 1; trusteeIndex <= 5; trusteeIndex += 1) {
    const shareOutputPath = path.join(
      outputDirectory,
      `trustee-${trusteeIndex}-public-decryption-share.json`,
    );
    run(
      "scripts/create_trustee_decryption_share.ts",
      path.join(ceremonyDirectory, `trustee-${trusteeIndex}-private-share.json`),
      encryptedTallyPath,
      shareOutputPath,
    );
    publicShareEntries.push({ path: path.basename(shareOutputPath) });
  }
  await writeFile(finalizeInputPath, `${JSON.stringify({
    encryptedTallyPath: path.basename(encryptedTallyPath),
    publicKeysetPath: path.basename(publicKeysetPath),
    decryptionShares: publicShareEntries,
    maxVotes: 2,
  }, null, 2)}\n`);
  run("scripts/finalize_eligible_tally.ts", finalizeInputPath, tallyResultPath);
} finally {
  await rm(privateCeremonyWorkspace, { recursive: true, force: true });
}

const batchArtifact = JSON.parse(await readFile(batchArtifactPath, "utf8")) as {
  manifest: {
    manifestDigest: string;
    aggregateCiphertextDigest: string;
    batchPublicInputsHash: string;
    verificationMode: string;
    ballotProofPublicInputsHashes: string[];
  };
};
const tallyResult = JSON.parse(await readFile(tallyResultPath, "utf8")) as {
  tallyCounts: number[];
  resultHash: string;
  tallyProofPublicInputsHash: string;
  verificationStatus: string;
  ceremonyModel: string;
};
const summary = {
  generatedAt: new Date().toISOString(),
  version: 3,
  mode: "zero-cost-local-unified-proof-demo",
  electionId,
  candidateListHash,
  eligibilityRoot: firstPackage.eligibilityRoot,
  ballotCount: 2,
  tallyCounts: tallyResult.tallyCounts,
  manifestDigest: batchArtifact.manifest.manifestDigest,
  aggregateCiphertextDigest: batchArtifact.manifest.aggregateCiphertextDigest,
  batchPublicInputsHash: batchArtifact.manifest.batchPublicInputsHash,
  resultHash: tallyResult.resultHash,
  tallyProofPublicInputsHash: tallyResult.tallyProofPublicInputsHash,
  localGasEvidence: {
    directUnifiedProofSubmission: 448831,
    trustedBatchCommitment: 213060,
    units: "local gas, not currency",
  },
  capabilities: [
    { id: "unifiedProof", label: "Eligibility + nullifier + encrypted-ballot Groth16 proof", status: "real" },
    { id: "rootRegistry", label: "Versioned eligibility-root registry", status: "real" },
    { id: "packages", label: "Root-bound canonical V3 vote packages", status: "real" },
    { id: "batchArtifacts", label: "Real-proof-checked V3 batch and receipts", status: "real-offchain" },
    { id: "threshold", label: "Independent 5-of-9 DLEQ trustee shares", status: "real-offchain" },
    { id: "omission", label: "Signed omission claims and Merkle resolution", status: "real" },
    { id: "batchProof", label: "Recursive on-chain batch-validity proof", status: "pending" },
    { id: "tallyProof", label: "On-chain tally SNARK", status: "pending" },
    { id: "productionDkg", label: "Audited distributed key generation", status: "pending" },
    { id: "anonAadhaar", label: "Live Anon Aadhaar test-mode proof", status: "external-pending" },
    { id: "erc4337", label: "Sponsored Amoy UserOperation", status: "external-pending" },
  ],
  verification: {
    eligibleProofsChecked: batchArtifact.manifest.ballotProofPublicInputsHashes.length,
    batchVerificationMode: batchArtifact.manifest.verificationMode,
    tallyVerificationStatus: tallyResult.verificationStatus,
    ceremonyModel: tallyResult.ceremonyModel,
  },
  trustBoundary:
    "Each vote has a real unified Groth16 proof. Batch contents and threshold shares are cryptographically verified off-chain. Recursive batch proof, on-chain tally proof, production DKG, and live external services remain explicit gates.",
};
await writeFile(
  path.join(outputDirectory, "demo-summary.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
);
console.log(JSON.stringify({ outputDirectory, ...summary }, null, 2));
