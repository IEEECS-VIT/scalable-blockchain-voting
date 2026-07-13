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

Provides a trusted registrar seam for local tests. The registrar records an
election-scoped identity nullifier and an ephemeral voting address.

It also exposes a proof-based registration seam through
`IEligibilityVerifier`. The verifier statement is:

- the registrant is eligible for this election;
- the proof is bound to this `electionId`;
- the proof authorizes this election-scoped `identityNullifier`; and
- the proof binds that nullifier to one ephemeral `votingKey`.

The repository includes both a test verifier and
`AnonAadhaarEligibilityVerifier`, which calls the official Anon Aadhaar
contract interface and then enforces election, nullifier, signal, timestamp,
and ephemeral-key bindings. A real proof and deployed official verifier remain
external inputs.

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

It also exposes `submitBallotWithProof`, which is connected to a generated
Groth16 verifier through `BallotGroth16VerifierAdapter`. The adapter verifies
the proof and explicitly checks that its election, ballot nullifier, and
Poseidon package commitment match the values accepted by `VotingContract`.
The trusted direct path remains only for local/reference tests.

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

The package provides the original secp256k1 compatibility demo plus a canonical
proof-compatible BabyJubJub path covering the real ballot proof, vote package,
aggregate-bound batch manifest, receipt, encrypted aggregation, and 5-of-9
threshold decryption. It also provides deterministic public-key hashes,
ballot-proof public-input hashing,
local demo decryption, homomorphic aggregation helpers, threshold share
generation, DLEQ-checked partial decryption shares, deterministic hashes,
canonical vote-package JSON, Merkle roots, inclusion receipts,
duplicate-nullifier checks, batch public-input hashing, encrypted tally input
aggregation, tally-result hash binding, and data-availability preflight checks.

Ballot validity is proved for the four-candidate BabyJubJub path, and version-2
batch/tally artifacts use that same ciphertext. Five trustee shares include
BabyJubJub DLEQ correctness proofs and are combined without reconstructing the
private key. Recursive batch validity and on-chain tally statements still need
circuits and verifier contracts for the stronger trustless version.

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

`generate_complete_demo_v2.ts` builds the real local proof-compatible flow and
`serve_demo.ts` exposes its status and artifacts to `frontend/demo/`. The UI
includes deterministic biometric failure/success, package, receipt, tally, and
public-verification walkthroughs. It is a local demonstration app, not a
production identity or wallet client.

## Demo versus future production

| Capability | Current status | Required stronger version |
| --- | --- | --- |
| Eligibility | Trusted registrar, official Anon Aadhaar adapter, and calldata builder | Live test proof and audited deployment |
| Biometrics | Deterministic pass/fail kiosk simulation with metadata-free audit | Optional regulated authentication gateway |
| Ballot encryption | Four-candidate proof-compatible BabyJubJub EC-ElGamal from ballot through threshold tally | Independent cryptographic review |
| Ballot proof | Real Groth16 one-hot/encryption proof, generated Solidity verifier, and contract binding adapter | Independent circuit review and production multi-party setup |
| Batching | Deterministic manifest builder, trusted root submission, plus verifier seam for proof-gated submission | Batch-validity and state-transition proof |
| Gas sponsorship | v0.6/v0.7 validation, bundler estimation/submission/polling bridge | Provider-issued Paymaster data and live evidence |
| Threshold tally | BabyJubJub 5-of-9 Shamir shares plus off-chain DLEQ share proofs | Distributed ceremony and verifier-compatible tally SNARK |
| Encrypted tally aggregation | Local aggregation plus result-hash binding from accepted batch artifacts | Proof-gated aggregation over verified batches |
| Tally verification | Verifier adapter plus test mock only | Generated and audited verifier contract |
| Data availability | Local/IPFS-gateway preflight script | Multi-provider persistence strategy |
| Storage upload | Canonical vote-package JSON upload through IPFS HTTP API | Multi-provider persistence and retrieval checks |
| Final-demo readiness | Strict artifact gate for real-vs-mock status | Independent audit plus deployed end-to-end walkthrough |
| Frontend | Functional local artifact-backed demo UI | Production app wired to wallet, relayer, storage, and live verifier artifacts |
