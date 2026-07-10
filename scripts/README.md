# Scripts

Deployment uses the repeatable Hardhat Ignition module in
`ignition/modules/VotingSystem.ts`.

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

Batch construction and tally scripts should only be added after their schemas
and proof statements are fixed. Empty or fake scripts would make the demo look
more complete than it is.
