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

It also exposes a proof-based registration seam through
`IEligibilityVerifier`. The verifier statement is:

- the registrant is eligible for this election;
- the proof is bound to this `electionId`;
- the proof authorizes this election-scoped `identityNullifier`; and
- the proof binds that nullifier to one ephemeral `votingKey`.

The current repository includes only a test verifier for this seam. It is not
an Anon Aadhaar verifier.

The TypeScript crypto package mirrors the registry's public-input hash so the
future frontend or Anon Aadhaar adapter can build the exact same proof signal
off-chain before calling `registerWithProof`.

Registration should be submitted by a relayer or registrar. An identifiable
wallet should not mint a public credential and register its voting key in the
same transaction.

`build_registration_request.ts` prepares the exact `registerWithProof`
calldata and public-input hash for a relayer. It does not run a live relayer
service yet, but it fixes the boundary between the voter-generated proof
package and the account that pays for the on-chain registration transaction.
`submit_registration_relayer.ts` can then submit that transaction with a
dedicated relayer key, and supports `--dry-run` so the request can be audited
before spending testnet gas.

### `VotingContract`

Provides a direct, one-transaction-per-ballot commitment path for contract
testing. It verifies that the sender is the registered ephemeral voting
address and rejects reused ballot nullifiers. It stores only a content digest,
not the vote or encrypted package.

This is a reference path, not the scalable batch path.

It also exposes `submitBallotWithProof`, a direct proof-gated seam for the
future ballot-validity verifier. That path stores the ballot proof public-input
hash beside the nullifier after a configured `IBallotProofVerifier` accepts
the proof. The repository includes only a test mock verifier for this seam; it
is not a real ballot-validity circuit.

### `BatchCommitment`

Records an append-only sequence of CID Merkle roots, nullifier roots, and
manifest digests. It enforces an authorized batcher and continuity from the
previous nullifier root.

It also exposes `submitBatchWithProof`, a proof-gated path for the scalable
design. That path accepts a `batchPublicInputsHash` and proof from a configured
`IBatchProofVerifier`, and it does not require the sender to be an authorized
trusted batcher. The repository includes only a test mock for this verifier.

It does **not** prove:

- that every ballot proof is valid;
- that all nullifiers inside a batch are unique;
- that no valid ballot was omitted;
- that the manifest remains available; or
- that the encrypted aggregate matches the committed ballots.

A real batch-validity/nullifier-state proof is required before the proof-gated
path can remove batcher trust in practice.

### `packages/crypto`

Defines the off-chain vote-package and batch-manifest formats used before data
is submitted to `BatchCommitment`. Vote packages intentionally exclude
timestamps, device IDs, client versions, and other fingerprinting metadata.

The package currently provides secp256k1 EC-ElGamal-style encrypted vote
vectors, deterministic public-key hashes, ballot-proof public-input hashing,
local demo decryption, homomorphic aggregation helpers, threshold share
generation, DLEQ-checked partial decryption shares, deterministic hashes,
canonical vote-package JSON, Merkle roots, inclusion receipts,
duplicate-nullifier checks, batch public-input hashing, encrypted tally input
aggregation, tally-result hash binding, and data-availability preflight checks.

It still does not prove ballot validity, prove batch validity, or verify a full
tally statement on-chain. Those pieces need real circuits and verifier
contracts.

### `TallyVerifier`

Accepts a tally only after an external verifier contract returns `true` for
the proof and public-input hash. The repository includes only a test mock for
this seam. It is not a SNARK verifier, so real verified tally publication
remains intentionally unavailable.

`build_tally_result.ts` now produces the `resultHash` and `publicInputsHash`
that should be supplied to this contract after a real tally proof is generated.
Those hashes bind the accepted batch manifests, batch public-input hashes,
aggregate ciphertext, decrypted counts, and decryption-share digests. They are
audit-friendly public inputs, not a replacement for the missing tally circuit.

### Deployment and readiness gates

The Ignition deployment module accepts optional `eligibilityVerifier` and
`tallyProofVerifier` parameters. They default to the zero address so local
tests stay safe, but real demo deployments should pass deployed verifier
addresses instead of relying on post-deploy ambiguity.

`check_demo_readiness.ts` is a strict reporting gate for the final demo. It
requires real proof artifacts, non-zero verifier/paymaster addresses, a real
sponsored UserOperation hash, and all planned frontend pages. Mock artifacts
are reported as blockers.

`generate_demo_fixture.ts` creates a deterministic local artifact set for
walking through the pipeline without live services. It is useful for demos and
script regression checks, but it intentionally uses placeholder proof bytes
and must not be presented as proof verification.

`frontend/demo/` contains a static demo UI for registration, voting, receipt,
batch, tally, and verification pages. It is a communication and walkthrough
layer, not a production Next.js app.

## Demo versus future production

| Capability | Current status | Required stronger version |
| --- | --- | --- |
| Eligibility | Trusted demo registrar plus verifier interface seam | Audited anonymous eligibility verifier |
| Biometrics | Not implemented | Optional regulated authentication gateway |
| Ballot encryption | secp256k1 EC-ElGamal-style encrypted vector | Audited election-crypto choice with proof-compatible encoding |
| Ballot proof | Verifier seam plus test mock only | Real circuit proving one valid selection |
| Batching | Deterministic manifest builder, trusted root submission, plus verifier seam for proof-gated submission | Batch-validity and state-transition proof |
| Gas sponsorship | Not implemented | Real ERC-4337 UserOperation and Paymaster |
| Threshold tally | Local Shamir-style shares plus off-chain DLEQ share proofs | Audited threshold ceremony and verifier-compatible decryption proofs |
| Encrypted tally aggregation | Local aggregation plus result-hash binding from accepted batch artifacts | Proof-gated aggregation over verified batches |
| Tally verification | Verifier adapter plus test mock only | Generated and audited verifier contract |
| Data availability | Local/IPFS-gateway preflight script | Multi-provider persistence strategy |
| Storage upload | Canonical vote-package JSON upload through IPFS HTTP API | Multi-provider persistence and retrieval checks |
| Final-demo readiness | Strict artifact gate for real-vs-mock status | Independent audit plus deployed end-to-end walkthrough |
| Frontend | Static labeled demo UI | Production app wired to wallet, relayer, storage, and verifier artifacts |
