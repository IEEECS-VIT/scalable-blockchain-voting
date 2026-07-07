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
- [ ] Integrate Anon Aadhaar test mode behind the verifier interface
- [x] Bind the election ID and ephemeral voting key into the proof signal
- [ ] Submit registration through a relayer
- [ ] Remove the trusted registrar path when proof verification is ready

## Milestone 3 - Ballot cryptography

- [x] Specify the encrypted vote vector and curve
- [x] Implement client-side EC-ElGamal encryption
- [ ] Build a real ballot-validity circuit
- [x] Bind election ID, candidate-list hash, ciphertext, and nullifier
- [x] Add malformed-ballot and duplicate-nullifier tests

## Milestone 4 - Storage and batching

- [x] Define a minimal vote-package schema without timestamps or client
  fingerprinting fields
- [x] Upload encrypted packages to IPFS
- [x] Build deterministic batch manifests and inclusion receipts
- [ ] Implement a batch-validity/nullifier-state-transition circuit
- [x] Add data-availability preflight failure handling

## Milestone 5 - Tally

- [x] Aggregate locally validated ballots from accepted batch artifacts
- [x] Implement local partial threshold decryptions without reconstructing the
  key
- [x] Add off-chain DLEQ correctness proofs for decryption shares
- [x] Build a tally result artifact that binds accepted batches, election
  configuration, aggregate ciphertext, decrypted totals, and decryption-share
  digests into publishable hashes
- [ ] Replace tally result hash-binding with a real tally proof circuit
- [ ] Connect the generated verifier to `TallyVerifier`

## Milestone 6 - User experience

- [ ] Build registration, voting, receipt, batch, tally, and verification pages
- [ ] Implement a real sponsored ERC-4337 UserOperation on Amoy
- [ ] Add explorer links and clearly labeled failure demonstrations
- [ ] Add deployment and demo documentation

## Definition of a credible final demo

At minimum, the final presentation should contain one real ballot proof, one
real on-chain tally-proof verification, and one real sponsored UserOperation.
Any remaining simulations must be visibly labeled.
