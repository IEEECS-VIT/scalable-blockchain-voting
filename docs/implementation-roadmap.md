# Implementation roadmap

## Milestone 1 - Foundation

- [x] Hardhat 3 and TypeScript setup
- [x] Amoy network configuration
- [x] Environment-variable template
- [x] Base contracts and deployment module
- [x] Initial contract tests
- [x] Explicit trust-boundary documentation

## Milestone 2 - Registration

- [x] Define the exact anonymous eligibility statement
- [x] Add an eligibility-verifier interface seam
- [x] Integrate the official Anon Aadhaar verifier interface behind an adapter
- [x] Build an Anon Aadhaar proof-to-registration calldata bridge
- [x] Bind the election ID and ephemeral voting key into the proof signal
- [x] Build the relayer-safe registration request/calldata package
- [x] Add a dedicated relayer submission script with dry-run safety
- [ ] Execute proof registration through a live Amoy relayer
- [ ] Remove the trusted registrar path when proof verification is ready

## Milestone 3 - Ballot cryptography

- [x] Specify the encrypted vote vector and curve
- [x] Implement client-side EC-ElGamal encryption
- [x] Add an on-chain verifier seam for proof-gated direct ballot submission
- [x] Build a real ballot-validity circuit
- [x] Bind election ID, candidate-list hash, ciphertext, and nullifier
- [x] Add malformed-ballot and duplicate-nullifier tests
- [x] Migrate canonical vote packages, aggregate-bound batch manifests, and
  encrypted tally aggregation to the proof-compatible BabyJubJub ciphertext
- [x] Migrate threshold decryption shares from the legacy secp256k1 path to
  BabyJubJub
- [x] Combine private eligibility membership, election nullifier derivation,
  package commitment, and encrypted ballot validity in one V3 circuit
- [x] Deploy a generated verifier adapter and relayer-safe direct V3 contract

## Milestone 4 - Storage and batching

- [x] Define a minimal vote-package schema without timestamps or client
  fingerprinting fields
- [x] Upload encrypted packages to IPFS
- [x] Build deterministic batch manifests and inclusion receipts
- [x] Add an on-chain verifier seam for proof-gated batch submission
- [ ] Implement a batch-validity/nullifier-state-transition circuit
- [x] Add data-availability preflight failure handling
- [x] Bind active eligibility root, real proof hashes, candidate list,
  encryption key, aggregate ciphertext, and package leaves into V3 manifests
- [x] Cryptographically verify every V3 ballot proof before batch generation
- [x] Add signed batcher intake receipts and resolvable omission claims

## Milestone 5 - Tally

- [x] Aggregate locally validated ballots from accepted batch artifacts
- [x] Implement local partial threshold decryptions without reconstructing the
  key
- [x] Add off-chain DLEQ correctness proofs for decryption shares
- [x] Separate ceremony, trustee share generation, and combiner commands so the
  combiner receives no trustee private share
- [x] Build a tally result artifact that binds accepted batches, election
  configuration, aggregate ciphertext, decrypted totals, and decryption-share
  digests into publishable hashes
- [ ] Replace tally result hash-binding with a real tally proof circuit
- [ ] Connect the generated verifier to `TallyVerifier`

## Milestone 6 - User experience

- [x] Build static demo pages for registration, voting, receipt, batch, tally,
  and verification
- [x] Add an artifact-backed local dashboard and interactive biometric,
  ballot, receipt, tally, and public-verification walkthroughs
- [x] Implement ERC-4337 v0.6/v0.7 validation, bundler estimation, submission,
  receipt polling, and evidence output
- [ ] Execute a provider-sponsored ERC-4337 UserOperation on Amoy
- [x] Add clearly labeled failure demonstrations and trust-boundary UI labels
- [ ] Add live explorer links after Amoy deployment
- [x] Add a final-demo readiness gate for real-vs-mock artifacts
- [x] Add a deterministic local demo fixture generator
- [x] Add local demo runbook and research-alignment review
- [x] Add complete live deployment documentation and parameter templates
- [x] Upgrade the generated local dashboard and artifacts to V3
- [x] Prevent trustee private-share and ballot-witness fields from being served
- [x] Add reproducible gas and synthetic scale regression benchmarks
- [ ] Record live addresses and explorer links after external deployment

## Definition of a credible final demo

The repository-local V3 Plan B demo is complete when it shows a unified
eligibility/nullifier/ballot proof, root-bound encrypted packages, deterministic
proof-checked batching and receipts, duplicate rejection, omission
accountability, and a real 5-of-9 local threshold result. Live-testnet completion is
separately gated on an actual Anon Aadhaar test proof, deployed Amoy addresses,
IPFS persistence, and a provider-sponsored UserOperation. Any permitted Plan B
simulation must remain visibly labeled.

## Post-demo trust-minimization work

- [ ] Implement recursive batch-validity/nullifier-state proof aggregation
- [ ] Implement an on-chain-verifiable threshold tally SNARK
- [ ] Replace the demo dealer ceremony with audited distributed key generation
- [ ] Run real-proof distributed load, data-availability, and failure benchmarks
- [ ] Complete independent circuit, contract, and ceremony audits
