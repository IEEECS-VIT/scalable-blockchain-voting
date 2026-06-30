# Demo architecture

## Target flow

```text
eligibility proof
  -> election-scoped identity
  -> ephemeral voting key
  -> encrypted ballot package
  -> ballot validity proof
  -> IPFS/content-addressed storage
  -> batch manifest and Merkle roots
  -> on-chain batch commitment
  -> encrypted aggregation
  -> threshold decryption shares
  -> tally proof
  -> on-chain verifier
```

## What the current contracts establish

### `ElectionConfig`

Creates immutable election parameters: election ID, candidate-list hash,
public-key hash, and voting window.

### `VoterRegistry`

Provides a trusted registrar seam for the first demo. The registrar records an
election-scoped identity nullifier and an ephemeral voting address. It does not
verify Anon Aadhaar yet, and it must not be described as anonymous eligibility
proof verification.

Registration should be submitted by a relayer or registrar. An identifiable
wallet should not mint a public credential and register its voting key in the
same transaction.

### `VotingContract`

Provides a direct, one-transaction-per-ballot commitment path for contract
testing. It verifies that the sender is the registered ephemeral voting
address and rejects reused ballot nullifiers. It stores only a content digest,
not the vote or encrypted package.

This is a reference path, not the scalable batch path.

### `BatchCommitment`

Records an append-only sequence of CID Merkle roots, nullifier roots, and
manifest digests. It enforces an authorized batcher and continuity from the
previous nullifier root.

It does **not** prove:

- that every ballot proof is valid;
- that all nullifiers inside a batch are unique;
- that no valid ballot was omitted;
- that the manifest remains available; or
- that the encrypted aggregate matches the committed ballots.

A batch-validity/nullifier-state proof is required to remove this trust.

### `packages/crypto`

Defines the off-chain vote-package and batch-manifest formats used before data
is submitted to `BatchCommitment`. Vote packages intentionally exclude
timestamps, device IDs, client versions, and other fingerprinting metadata.

The package currently provides secp256k1 EC-ElGamal-style encrypted vote
vectors, deterministic public-key hashes, ballot-proof public-input hashing,
local demo decryption, homomorphic aggregation helpers, deterministic hashes,
Merkle roots, inclusion receipts, and duplicate-nullifier checks.

It still does not prove ballot validity, prove batch validity, or perform
threshold decryption. Those pieces need real circuits and verifier contracts.

### `TallyVerifier`

Accepts a tally only after an external verifier contract returns `true` for
the proof and public-input hash. No verifier is included yet, so verified tally
publication remains intentionally unavailable.

## Demo versus future production

| Capability | Current status | Required stronger version |
| --- | --- | --- |
| Eligibility | Trusted demo registrar | Audited anonymous eligibility verifier |
| Biometrics | Not implemented | Optional regulated authentication gateway |
| Ballot encryption | secp256k1 EC-ElGamal-style encrypted vector | Audited election-crypto choice with proof-compatible encoding |
| Ballot proof | Not implemented | Real circuit proving one valid selection |
| Batching | Deterministic manifest builder plus trusted root submission | Batch-validity and state-transition proof |
| Gas sponsorship | Not implemented | Real ERC-4337 UserOperation and Paymaster |
| Threshold tally | Not implemented | Partial decryptions with correctness proofs |
| Tally verification | Verifier adapter only | Generated and audited verifier contract |
| Storage | Not implemented | Availability and persistence strategy |
