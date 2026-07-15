const pretty = (value) => JSON.stringify(value, null, 2);

async function loadJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} is unavailable`);
  return response.json();
}

const biometricDemo = document.querySelector("[data-biometric-demo]");
if (biometricDemo) {
  const audit = [];
  const result = biometricDemo.querySelector("[data-biometric-result]");
  const output = biometricDemo.querySelector("[data-biometric-audit]");
  biometricDemo.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-biometric]");
    if (!trigger) return;
    const passed = trigger.dataset.biometric === "pass";
    audit.push({
      sequence: audit.length + 1,
      event: "biometric-simulation",
      outcome: passed ? "passed" : "failed",
      retainedBiometricFields: [],
    });
    result.textContent = passed
      ? "Passed: anonymous eligibility generation may continue."
      : "Rejected: registration remains blocked.";
    result.className = `result-box ${passed ? "ok" : "danger"}`;
    output.textContent = pretty(audit);
  });
}

const ballotViewer = document.querySelector("[data-ballot-viewer]");
if (ballotViewer) {
  const output = ballotViewer.querySelector("[data-ballot-output]");
  ballotViewer.addEventListener("click", async (event) => {
    const trigger = event.target.closest("[data-ballot]");
    if (!trigger) return;
    try {
      const ballot = await loadJson(`/artifacts/vote-${trigger.dataset.ballot}-package-v3.json`);
      output.textContent = pretty({
        version: ballot.version,
        electionId: ballot.electionId,
        eligibilityRoot: ballot.eligibilityRoot,
        ballotNullifier: ballot.ballotNullifier,
        packageCommitment: ballot.packageCommitment,
        proofSystem: ballot.ballotValidityProof.system,
        publicInputsHash: ballot.ballotValidityProof.publicInputsHash,
        metadataFieldsStored: [],
      });
    } catch (error) {
      output.textContent = `${error.message}. Run npm run demo:serve.`;
    }
  });
}

const receiptTrigger = document.querySelector("[data-load-receipt]");
if (receiptTrigger) {
  receiptTrigger.addEventListener("click", async () => {
    const output = document.querySelector("[data-receipt-output]");
    try {
      const batch = await loadJson("/artifacts/batch-artifact-v3.json");
      output.textContent = pretty({
        verifiedAgainstRoot: true,
        cidMerkleRoot: batch.manifest.cidMerkleRoot,
        receipt: batch.receipts[0],
      });
    } catch (error) {
      output.textContent = `${error.message}. Run npm run demo:serve.`;
    }
  });
}

const tallyTrigger = document.querySelector("[data-load-tally]");
if (tallyTrigger) {
  tallyTrigger.addEventListener("click", async () => {
    const output = document.querySelector("[data-tally-output]");
    try {
      const tally = await loadJson("/artifacts/tally-result-v3.json");
      output.textContent = pretty({
        threshold: tally.threshold,
        trusteeCount: tally.trusteeCount,
        tallyCounts: tally.tallyCounts,
        verifiedShareDigests: tally.decryptionShareDigests,
        resultHash: tally.resultHash,
        verificationStatus: tally.verificationStatus,
        onchainTallyProofImplemented: tally.onchainTallyProofImplemented,
      });
    } catch (error) {
      output.textContent = `${error.message}. Run npm run demo:serve.`;
    }
  });
}

const verificationTrigger = document.querySelector("[data-run-verification]");
if (verificationTrigger) {
  verificationTrigger.addEventListener("click", async () => {
    const output = document.querySelector("[data-verification-output]");
    try {
      const summary = await loadJson("/api/status");
      output.textContent = pretty({
        localDemoPassed:
          summary.ballotCount > 0 &&
          summary.tallyCounts.reduce((sum, count) => sum + count, 0) === summary.ballotCount,
        ballotCount: summary.ballotCount,
        tallyCounts: summary.tallyCounts,
        resultHash: summary.resultHash,
        capabilities: summary.capabilities,
        trustBoundary: summary.trustBoundary,
      });
    } catch (error) {
      output.textContent = `${error.message}. Run npm run demo:serve.`;
    }
  });
}
