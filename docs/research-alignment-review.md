# Research alignment review

This document checks the current implementation against the revised research
plan and the core problems the demo is supposed to address.

## Summary

The project is aligned with the optimized plan as a credible testnet demo
scaffold with one complete real proof path. It is not yet a complete
cryptographic voting system because the real Anon Aadhaar integration, batch
circuit, tally circuit, and ERC-4337 sponsored transaction are still pending.

## Problem-by-problem status

| Problem | Current answer | Status |
| --- | --- | --- |
| Voter privacy | Election-scoped identity nullifier, ephemeral voting key, metadata-minimal vote package, relayer-ready registration | Partially solved |
| Ballot secrecy | EC-ElGamal-style encrypted vote vectors and aggregate ciphertexts | Demo-level solved |
| Double voting | Identity registration mapping, ballot nullifier tracking, batch nullifier accumulator | Strong scaffold, real batch proof pending |
| Scalability | Batch manifests, Merkle roots, inclusion receipts, proof-gated batch commitment seam | Scaffold solved, real batch circuit pending |
| Verifiability | Real ballot Groth16 proof, public-input bindings, verifier seams, readiness gate, receipt proofs | Ballot path solved; batch/tally proofs pending |
| Low-cost demo | Local fixture, Amoy config, relayer scripts, no paid infrastructure required by default | Mostly solved |
| Honest presentation | Docs, UI labels, readiness gate, mock-proof blockers | Solved |

## What is innovative or unique

- The demo separates voter identity from on-chain registration through a
  relayer-ready request artifact.
- Vote packages intentionally avoid fingerprinting metadata such as timestamps,
  device IDs, browser versions, and client versions.
- The batching layer is deterministic and auditable: package digests,
  content-ID leaves, Merkle roots, nullifier roots, and public-input hashes are
  all reproducible.
- The project avoids a common demo mistake: it does not treat hash bindings or
  mock verifiers as real SNARKs.
- The readiness gate makes overclaiming difficult by blocking mock artifacts,
  missing proof files, zero verifier addresses, absent frontend pages, and
  missing sponsored UserOperation evidence.
- The local fixture lets reviewers reproduce the whole flow without requiring
  paid infrastructure.
- The ballot circuit proves the complete BabyJubJub EC-ElGamal equations and
  one-hot selection while binding the proof to the contract election,
  nullifier, and Poseidon package commitment.

## Where it still falls short

The remaining blockers are real, not cosmetic:

1. Anon Aadhaar test-mode integration is not wired.
2. The batch-validity/nullifier-state transition circuit is not implemented.
3. The tally proof circuit is not implemented.
4. The real ballot verifier is connected locally but has no live Amoy
   deployment evidence yet.
5. No live Amoy relayer transaction evidence is included.
6. No real ERC-4337 sponsored UserOperation evidence is included.
7. The static frontend is a demo UI, not a production app.

## Honest final assessment

The repository now solves the architecture, artifact, and trust-boundary parts
of the revised plan well. It is structured, testable, and unusually honest for
a demo project because every mock seam is labeled and gated.

It now has one real end-to-end proof path: circuit, proof generation, generated
Solidity verifier, adapter binding checks, and `VotingContract` acceptance.
The next truly important step is batch validity, followed by tally proof.

## Recommended next implementation order

1. Batch-validity/nullifier-state circuit.
2. Tally proof circuit.
3. Anon Aadhaar test-mode verifier adapter.
5. Live Amoy deployment with verifier addresses.
6. Real ERC-4337 sponsored registration or ballot action.
7. Replace the static frontend demo with a production web app.
