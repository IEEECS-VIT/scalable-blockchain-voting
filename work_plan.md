# Work Plan — scalable-blockchain-voting

## Phase 1 — Static Security Analysis (Slither)

**Objective:** Run Slither on all Solidity contracts, produce `docs/security-analysis.md`.

Tasks:
1. Install Slither (`pip install slither-analyzer`)
2. Run against `contracts/`
3. Fix low-risk issues; document accepted/false-positive findings
4. Produce `docs/security-analysis.md` with table and before/after counts

**Deliverable:** `docs/security-analysis.md` + minimal contract fixes

---

## Phase 2 — Continuous Integration Pipeline

**Objective:** GitHub Actions workflow + badge + docs.

Tasks:
1. Create `.github/workflows/ci.yml` (push/PR to main)
2. Add status badge to README.md
3. Document in `docs/ci.md`

**Deliverable:** `.github/workflows/ci.yml`, README badge, `docs/ci.md`

---

## Phase 3 — Adversarial Testing and Gas Benchmarking

**Objective:** Extended tests + gas benchmarking.

### 3a — Adversarial tests
- One-hot violation, duplicate nullifier, wrong electionId, proof reuse, malformed ballot
- All in `test/adversarial/`

### 3b — Gas benchmarks
- Run at batch sizes 10, 50, 100, 250
- Produce `docs/gas-benchmarks.md`

**Deliverable:** `test/adversarial/` + `docs/gas-benchmarks.md`

---

## Phase 4 — Documentation: Future Work

**Objective:** `docs/future-work.md` with 5 sections

**Deliverable:** `docs/future-work.md`

---

## Final Step

Produce `docs/project-additions-summary.md`

---

## Ground Rules

1. College project on semester timeline
2. Prefer additions over modifications
3. Do NOT implement: recursive/folding proofs, on-chain tally SNARK, real DKG
4. Every phase produces something demonstrable
5. Never weaken existing honesty about limitations
6. Ask before deleting/overwriting existing files
7. Work phases in order
