# Implementation roadmap

## Milestone 1 - Foundation

- [x] Hardhat 3 and TypeScript setup
- [x] Amoy network configuration
- [x] Environment-variable template
- [x] Base contracts and deployment module
- [x] Initial contract tests
- [x] Explicit trust-boundary documentation

## Milestone 2 - Registration

- [ ] Define the exact anonymous eligibility statement
- [ ] Integrate Anon Aadhaar test mode behind a verifier interface
- [ ] Bind the election ID and ephemeral voting key into the proof signal
- [ ] Submit registration through a relayer
- [ ] Remove the trusted registrar path when proof verification is ready

## Milestone 3 - Ballot cryptography

- [ ] Specify the encrypted vote vector and curve
- [ ] Implement client-side EC-ElGamal encryption
- [ ] Build a real ballot-validity circuit
- [ ] Bind election ID, candidate-list hash, ciphertext, and nullifier
- [ ] Add malformed-ballot and duplicate-nullifier tests

## Milestone 4 - Storage and batching

- [x] Define a minimal vote-package schema without timestamps or client
  fingerprinting fields
- [ ] Upload encrypted packages to IPFS
- [x] Build deterministic batch manifests and inclusion receipts
- [ ] Implement a batch-validity/nullifier-state-transition circuit
- [ ] Add data-availability failure handling

## Milestone 5 - Tally

- [ ] Aggregate only ballots proven valid and committed in accepted batches
- [ ] Implement partial threshold decryptions without reconstructing the key
- [ ] Prove each decryption share
- [ ] Bind all accepted batch roots, election configuration, aggregate
  ciphertext, and published totals into the tally proof
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
