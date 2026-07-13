const statusGrid = document.querySelector("[data-demo-status]");
const summaryNode = document.querySelector("[data-demo-summary]");
const ballotCountNode = document.querySelector("[data-ballot-count]");
const realCapabilitiesNode = document.querySelector("[data-real-capabilities]");
const candidateResultsNode = document.querySelector("[data-candidate-results]");

const statusClass = (status) =>
  status === "real" || status === "real-offchain" ? "ok" : "pending";

const statusLabel = (status) => ({
  real: "Verified on-chain path",
  "real-offchain": "Verified locally",
  pending: "Advanced proof pending",
  "external-pending": "External service required",
})[status] ?? status;

function renderCandidateResults(counts) {
  if (candidateResultsNode === null) return;
  const names = ["Candidate A", "Candidate B", "Candidate C", "Candidate D"];
  const highest = Math.max(...counts, 1);
  candidateResultsNode.replaceChildren();
  counts.forEach((count, index) => {
    const row = document.createElement("div");
    row.className = "candidate-row";
    const name = document.createElement("span");
    name.textContent = names[index] ?? `Candidate ${index + 1}`;
    const track = document.createElement("div");
    track.className = "result-bar";
    const fill = document.createElement("i");
    fill.style.width = `${(count / highest) * 100}%`;
    track.append(fill);
    const value = document.createElement("strong");
    value.textContent = String(count);
    row.append(name, track, value);
    candidateResultsNode.append(row);
  });
}

if (statusGrid !== null) {
  fetch("/api/status", { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("status unavailable");
      return response.json();
    })
    .then((summary) => {
      statusGrid.replaceChildren();
      const realCapabilities = summary.capabilities.filter(
        (capability) => statusClass(capability.status) === "ok",
      ).length;
      for (const capability of summary.capabilities) {
        const card = document.createElement("article");
        card.className = "status-card";
        const marker = document.createElement("span");
        marker.className = statusClass(capability.status);
        marker.textContent = marker.className === "ok" ? "●" : "○";
        const content = document.createElement("div");
        const heading = document.createElement("strong");
        heading.textContent = capability.label;
        const detail = document.createElement("small");
        detail.textContent = statusLabel(capability.status);
        content.append(heading, detail);
        card.append(marker, content);
        statusGrid.append(card);
      }
      if (ballotCountNode !== null) ballotCountNode.textContent = summary.ballotCount;
      if (realCapabilitiesNode !== null) realCapabilitiesNode.textContent = realCapabilities;
      renderCandidateResults(summary.tallyCounts);
      if (summaryNode !== null) {
        summaryNode.textContent = JSON.stringify({
          ballotCount: summary.ballotCount,
          tallyCounts: summary.tallyCounts,
          manifestDigest: summary.manifestDigest,
          aggregateCiphertextDigest: summary.aggregateCiphertextDigest,
          resultHash: summary.resultHash,
        }, null, 2);
      }
    })
    .catch(() => {
      statusGrid.textContent =
        "Run npm run demo:serve to load generated cryptographic artifacts.";
      if (candidateResultsNode !== null) {
        candidateResultsNode.textContent = "Local artifact server is not running.";
      }
    });
}
