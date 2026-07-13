# Research alignment review

This review compares the implementation with Revised Plan B v2.0 and keeps
repository-local completion separate from live external evidence.

## Verdict

The zero-cost local demonstration is complete and exceeds the Plan B MVP in
its ballot and threshold cryptography. The same repository can be taken to
Amoy using the included deployment and submission bridges, but a live Anon
Aadhaar proof, faucet-funded deployer, IPFS provider, Paymaster-issued
UserOperation, transaction hashes, and explorer links cannot be committed in
advance or simulated as real evidence.

Plan B explicitly permits a mocked eligibility proof, trusted local batcher,
test trustees, Paymaster simulation, a simplified nullifier design, and a
verifier-hash tally phase. This implementation goes further with a real
BabyJubJub/Groth16 ballot proof, an official Anon Aadhaar contract adapter, and
real 5-of-9 DLEQ-verified threshold decryption.

## Acceptance checklist

| Plan B condition | Evidence in this repository | Status |
| --- | --- | --- |
| Biometric-gated registration | Interactive deterministic pass/fail screen; audit retains no biometric fields | Complete simulation |
| Privacy | Election-scoped identity, relayer boundary, metadata-minimal packages, encrypted choices | Complete for demo |
| Election identity | Election ID is part of registration and ballot bindings | Complete |
| Encryption | BabyJubJub EC-ElGamal ciphertexts | Complete |
| Ballot validity | Real one-hot/encryption Groth16 circuit and generated Solidity verifier | Complete |
| Double voting | Registration and ballot nullifier rejection plus batch duplicate checks | Complete |
| Batching | Deterministic manifests, CID/package Merkle root, nullifier continuity, aggregate commitment | Complete trusted Plan B batcher |
| Inclusion | Generated and tested Merkle receipts | Complete |
| Tally | Homomorphic aggregation and 5-of-9 DLEQ-verified decryption | Complete local Plan B tally |
| Public verification | Artifact dashboard, verifier scripts, hashes, and strict readiness gate | Complete locally |
| Zero cost | Local generation plus free-testnet configuration | Complete locally; live services require user accounts/faucet |

## Novel and defensible aspects

- The real ballot proof binds election ID, candidate-list hash, canonical
  nullifier, election public key, every ciphertext point, and the exact package
  commitment. Changing any of these invalidates acceptance.
- The proof-compatible version-2 package remains on BabyJubJub through
  deterministic batching, encrypted aggregation, and threshold decryption;
  there is no curve-switch shortcut in the canonical path.
- Five DLEQ-proved trustee contributions can decrypt a 5-of-9 tally without
  reconstructing the private key in the combiner.
- Stored vote packages deliberately omit timestamps, browser versions, device
  identifiers, and client metadata, reducing avoidable voter fingerprinting.
- The aggregate ciphertext is committed into the batch artifact, making a
  tally substitution detectable even before a future recursive batch proof.
- The project treats trust-boundary honesty as a feature: mocks, hash bindings,
  external credentials, and real SNARKs have different machine-readable
  statuses and readiness gates.

These are meaningful system-design contributions for a student testnet demo.
They are not, by themselves, a legal patent-novelty opinion or proof of academic
novelty. A competition panel, supervisor, paper reviewers, or patent examiner
ultimately judges novelty against prior art.

## Remaining external evidence

1. Generate an Anon Aadhaar test-mode proof and submit adapter-bound
   registration calldata through a relayer.
2. Deploy the contracts on Polygon Amoy and record addresses/transactions.
3. Upload package/manifest content to a real IPFS provider or local node.
4. Obtain Paymaster sponsorship data from a provider and send one ERC-4337
   UserOperation through the included bundler bridge.
5. Add the resulting explorer and content links to the dashboard evidence.

## Stronger post-demo research work

The trusted Plan B batcher can be removed only with recursive verification (or
an equivalent aggregation proof) that validates all private ballot proofs and
the nullifier-state transition. Likewise, the current real threshold tally is
verified off-chain; an audited tally circuit and generated verifier are needed
for trustless on-chain tally verification. These are production/research
extensions, not hidden claims of the current demo.
