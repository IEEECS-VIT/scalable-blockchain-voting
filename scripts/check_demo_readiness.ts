import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { isAddress, isHex } from "viem";

type ProofArtifact = {
  mock?: boolean;
  verifierAddress?: string;
  circuitPath?: string;
  wasmPath?: string;
  zkeyPath?: string;
  verificationKeyPath?: string;
  notes?: string;
};

type SponsoredUserOperationArtifact = {
  mock?: boolean;
  paymasterAddress?: string;
  userOperationHash?: string;
  transactionHash?: string;
  notes?: string;
};

type FrontendArtifact = {
  mock?: boolean;
  pages?: readonly string[];
  notes?: string;
};

type ReadinessInput = {
  eligibility?: ProofArtifact;
  ballotValidity?: ProofArtifact;
  batchValidity?: ProofArtifact;
  tallyProof?: ProofArtifact;
  sponsoredUserOperation?: SponsoredUserOperationArtifact;
  frontend?: FrontendArtifact;
};

type CheckResult = {
  id: string;
  label: string;
  ready: boolean;
  blockers: string[];
};

const requiredFrontendPages = [
  "registration",
  "voting",
  "receipt",
  "batch",
  "tally",
  "verification",
] as const;

function usage(): never {
  throw new Error("Usage: npm run check:readiness -- <readiness.json> [--allow-blocked]");
}

async function fileExists(inputDir: string, path: string | undefined) {
  if (path === undefined || path.trim() === "") return false;
  try {
    await access(resolve(inputDir, path));
    return true;
  } catch {
    return false;
  }
}

function addressBlocker(value: string | undefined, label: string) {
  if (value === undefined || value.trim() === "") {
    return `${label} is missing`;
  }
  if (!isAddress(value)) {
    return `${label} is not a valid address`;
  }
  if (value.toLowerCase() === "0x0000000000000000000000000000000000000000") {
    return `${label} is zero address`;
  }
  return undefined;
}

function hashBlocker(value: string | undefined, label: string) {
  if (value === undefined || value.trim() === "") {
    return `${label} is missing`;
  }
  if (!isHex(value, { strict: true }) || value.length !== 66) {
    return `${label} is not a bytes32 hash`;
  }
  return undefined;
}

async function checkProofArtifact(params: {
  inputDir: string;
  id: string;
  label: string;
  artifact: ProofArtifact | undefined;
  requireCircuitFiles: boolean;
}): Promise<CheckResult> {
  const blockers: string[] = [];
  const artifact = params.artifact;
  if (artifact === undefined) {
    return {
      id: params.id,
      label: params.label,
      ready: false,
      blockers: ["artifact section is missing"],
    };
  }
  if (artifact.mock === true) {
    blockers.push("artifact is marked mock");
  }
  const verifierBlocker = addressBlocker(
    artifact.verifierAddress,
    "verifierAddress",
  );
  if (verifierBlocker !== undefined) blockers.push(verifierBlocker);

  if (params.requireCircuitFiles) {
    const fileChecks = [
      ["circuitPath", artifact.circuitPath],
      ["wasmPath", artifact.wasmPath],
      ["zkeyPath", artifact.zkeyPath],
      ["verificationKeyPath", artifact.verificationKeyPath],
    ] as const;
    for (const [label, path] of fileChecks) {
      if (!(await fileExists(params.inputDir, path))) {
        blockers.push(`${label} is missing or unreadable`);
      }
    }
  }

  return {
    id: params.id,
    label: params.label,
    ready: blockers.length === 0,
    blockers,
  };
}

function checkSponsoredUserOperation(
  artifact: SponsoredUserOperationArtifact | undefined,
): CheckResult {
  const blockers: string[] = [];
  if (artifact === undefined) {
    return {
      id: "sponsoredUserOperation",
      label: "Real sponsored ERC-4337 UserOperation",
      ready: false,
      blockers: ["artifact section is missing"],
    };
  }
  if (artifact.mock === true) blockers.push("artifact is marked mock");
  const paymasterBlocker = addressBlocker(
    artifact.paymasterAddress,
    "paymasterAddress",
  );
  if (paymasterBlocker !== undefined) blockers.push(paymasterBlocker);
  const userOperationBlocker = hashBlocker(
    artifact.userOperationHash,
    "userOperationHash",
  );
  if (userOperationBlocker !== undefined) blockers.push(userOperationBlocker);
  if (artifact.transactionHash !== undefined) {
    const transactionBlocker = hashBlocker(
      artifact.transactionHash,
      "transactionHash",
    );
    if (transactionBlocker !== undefined) blockers.push(transactionBlocker);
  }

  return {
    id: "sponsoredUserOperation",
    label: "Real sponsored ERC-4337 UserOperation",
    ready: blockers.length === 0,
    blockers,
  };
}

function checkFrontend(artifact: FrontendArtifact | undefined): CheckResult {
  const blockers: string[] = [];
  if (artifact === undefined) {
    return {
      id: "frontend",
      label: "Demo frontend pages",
      ready: false,
      blockers: ["artifact section is missing"],
    };
  }
  if (artifact.mock === true) blockers.push("artifact is marked mock");
  const pages = new Set(artifact.pages ?? []);
  for (const page of requiredFrontendPages) {
    if (!pages.has(page)) blockers.push(`missing ${page} page`);
  }

  return {
    id: "frontend",
    label: "Demo frontend pages",
    ready: blockers.length === 0,
    blockers,
  };
}

async function main() {
  const inputPath = process.argv.find((arg) => arg.endsWith(".json")) ?? usage();
  const allowBlocked = process.argv.includes("--allow-blocked");
  const inputDir = dirname(inputPath);
  const input = JSON.parse(await readFile(inputPath, "utf8")) as ReadinessInput;

  const checks: CheckResult[] = [
    await checkProofArtifact({
      inputDir,
      id: "eligibility",
      label: "Anonymous eligibility verifier",
      artifact: input.eligibility,
      requireCircuitFiles: false,
    }),
    await checkProofArtifact({
      inputDir,
      id: "ballotValidity",
      label: "Real ballot-validity proof",
      artifact: input.ballotValidity,
      requireCircuitFiles: true,
    }),
    await checkProofArtifact({
      inputDir,
      id: "batchValidity",
      label: "Batch validity and nullifier-state proof",
      artifact: input.batchValidity,
      requireCircuitFiles: true,
    }),
    await checkProofArtifact({
      inputDir,
      id: "tallyProof",
      label: "Real tally proof verifier",
      artifact: input.tallyProof,
      requireCircuitFiles: true,
    }),
    checkSponsoredUserOperation(input.sponsoredUserOperation),
    checkFrontend(input.frontend),
  ];

  const ready = checks.every((check) => check.ready);
  console.log(JSON.stringify({
    ready,
    summary: ready
      ? "credible final demo gates are satisfied"
      : "credible final demo gates are still blocked",
    checks,
  }, null, 2));

  if (!ready && !allowBlocked) {
    process.exitCode = 1;
  }
}

await main();
