# Scripts

Deployment uses the repeatable Hardhat Ignition module in
`ignition/modules/VotingSystem.ts`.

`setup_ballot_circuit.ts` compiles the real BabyJubJub ballot-validity circuit,
runs a local Groth16 testnet ceremony, exports the proving artifacts and
generated Solidity verifier, then refreshes the verifier-bound test fixture.
`build_ballot_circuit_input.ts` creates a
deterministic circuit witness, and `generate_ballot_proof.ts` emits proof JSON,
public signals, Solidity-compatible proof bytes, and the adapter hash.

```bash
npm run circuit:setup:ballot
npm run circuit:input:ballot -- ./ballot-input.json 1
npm run proof:ballot -- ./ballot-input.json ./ballot-proof-output
```

Candidate indices are `0` through `3`. The local ceremony is appropriate for
the zero-cost testnet demo, not a production election.

The version-2 commands continue from the real proof artifact into the
canonical BabyJubJub data pipeline:

```bash
npm run build:vote-package:v2 -- descriptor.json vote-package-v2.json
npm run build:batch:v2 -- batch-input.json batch-artifact-v2.json
npm run build:tally:v2 -- tally-input.json encrypted-tally-v2.json
```

The package descriptor binds the original `electionId`, `candidateListHash`,
canonical field-encoded `ballotNullifier`, circuit input, and proof artifact.
The batch artifact commits its exact encrypted aggregate. The tally command
rebuilds every accepted batch before aggregation. Finalization creates and
verifies five of nine BabyJubJub trustee shares with DLEQ proofs and combines
them without reconstructing the election private key:

```bash
npm run finalize:tally:v2 -- finalize-config.json threshold-output
```

The deterministic coefficients in the complete local demo simulate nine test
institutions; they are not a production distributed key ceremony.

The V3 path replaces separate eligibility and ballot statements with one
root-bound proof and verifies every proof before producing a batch:

```bash
npm run circuit:input:eligible-ballot -- eligible-input.json 1 1
npm run proof:eligible-ballot -- eligible-input.json eligible-proof-output
npm run build:vote-package:v3 -- descriptor.json vote-package-v3.json
npm run build:batch:v3 -- batch-input.json batch-artifact-v3.json
npm run build:tally:v3 -- tally-input.json encrypted-tally-v3.json
```

Trustee operations are separate in V3. The ceremony command creates one
private file per trustee, each trustee command consumes only its own file, and
the finalizer consumes only public DLEQ-proved shares:

```bash
npm run ceremony:threshold -- ceremony-config.json ceremony-output
npm run trustee:decrypt-share -- trustee-private.json encrypted-tally-v3.json public-share.json
npm run finalize:tally:v3 -- finalize-input.json tally-result-v3.json
```

The ceremony command is a demo dealer workflow, not production DKG. Never put
its private-share output under a web-served or committed directory.

`upload_vote_package.ts` validates a vote-package JSON file, rewrites it into
canonical JSON, and uploads that exact content through an IPFS HTTP API. It
prints the resulting `ipfs://...` content ID and the package digest.

```bash
npm run upload:vote-package -- path/to/vote-package.json
```

The upload script has an optional local mock-IPFS test. It is skipped by
default because some sandboxes block localhost listeners:

```bash
RUN_IPFS_UPLOAD_SCRIPT_TEST=1 npm run test:crypto
```

`build_registration_request.ts` turns an eligibility proof package into the
exact `VoterRegistry.registerWithProof` calldata a relayer should submit. This
keeps the voter-facing step separate from the on-chain relayer account.

```bash
npm run build:registration-request -- path/to/registration-request-input.json
```

`submit_registration_relayer.ts` submits that generated relayer transaction
with a dedicated relayer key. Use `--dry-run` first to verify the transaction
without sending it.

```bash
npm run submit:registration-relayer -- path/to/registration-request-artifact.json --dry-run
RELAYER_PRIVATE_KEY=0x... RELAYER_RPC_URL=https://... npm run submit:registration-relayer -- path/to/registration-request-artifact.json
```

`build_batch_manifest.ts` turns uploaded package references into the batcher's
finalization artifact: the deterministic manifest, inclusion receipts, the
exact trusted-demo `BatchCommitment.submitBatch` arguments, and the
`submitBatchWithProof` argument prefix that should be paired with a real batch
proof later.

Input shape:

```json
{
  "electionId": "0x...",
  "previousNullifierRoot": "0x...",
  "knownPreviousNullifiers": [],
  "packages": [
    { "contentId": "ipfs://bafy...", "path": "vote-package.json" }
  ]
}
```

Run:

```bash
npm run build:batch -- path/to/batch-input.json
```

`check_data_availability.ts` is a batcher preflight. It validates that the
local package files are readable, canonical, election-matched, and optionally
match expected digests. If `CHECK_IPFS_FETCH=1` is set, it also fetches the
`ipfs://...` content through `IPFS_GATEWAY_URL` and compares the fetched digest
with the local package digest.

```bash
npm run check:data -- path/to/batch-input.json
CHECK_IPFS_FETCH=1 IPFS_GATEWAY_URL=https://ipfs.io/ipfs/ npm run check:data -- path/to/batch-input.json
```

`check_demo_readiness.ts` is the honest final-demo gate. It fails unless the
required anonymous eligibility, ballot proof, batch proof, tally proof,
sponsored UserOperation, and frontend artifacts are present and not marked as
mock.

```bash
npm run check:readiness -- path/to/readiness.json
```

Use `--allow-blocked` when you want a JSON report without failing the command:

```bash
npm run check:readiness -- path/to/readiness.json --allow-blocked
```

`generate_demo_fixture.ts` creates a deterministic local demo fixture containing
registration, vote package, batch, encrypted tally, decryption-share, and tally
result artifacts. It uses placeholder proof bytes and labels the output as
local-only, so it is useful for demos and script testing but not proof
verification.

```bash
npm run demo:fixture -- ./demo-output
```

For the current real-proof local path, generate and serve the complete V3 demo:

```bash
npm run demo:complete -- ./demo-output-v3
npm run demo:serve
```

Run measurable regression benchmarks with:

```bash
npx hardhat test --no-compile test/GasBenchmark.ts
npm run benchmark:scale -- 10000
```

The scale command explicitly excludes real proof, storage, and network costs.

`build_anon_aadhaar_registration.ts` checks the official Anon Aadhaar public
signals and emits adapter-bound `registerWithProof` calldata. It requires a
real proof descriptor; it never fabricates identity evidence.

`submit_sponsored_user_operation.ts` validates v0.6 or v0.7 Paymaster fields,
checks the bundler EntryPoint, estimates gas in dry-run mode, and sends/polls
only with `--send`:

```bash
npm run submit:userop -- sponsored-userop.json evidence.json
npm run submit:userop -- sponsored-userop.json evidence.json --send
```

`build_tally_input.ts` validates accepted batch artifacts against their package
files, aggregates only those encrypted ballots, and outputs the encrypted tally
public inputs for the future tally proof.

```bash
npm run build:tally -- path/to/tally-input.json
```

`build_tally_result.ts` reads the encrypted tally artifact plus trustee
decryption-share files, verifies the share proofs, decrypts the final counts,
and outputs the `resultHash` and `publicInputsHash` that should be passed to
`TallyVerifier.publishTally` once a real proof is generated.

```bash
npm run build:tally-result -- path/to/tally-result-input.json
```

The batch/tally public-input hashes are audit bindings, not SNARKs. The local
batcher trust boundary and pending tally circuit stay explicit in every output.
