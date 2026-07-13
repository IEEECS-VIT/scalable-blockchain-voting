# Scalable Blockchain Voting

Zero-cost testnet demonstration of a privacy-preserving voting pipeline using
election-scoped identities, encrypted ballot packages, batch commitments, and
verifiable tally publication.

## Current status

This repository includes:

- a Hardhat 3 + TypeScript development environment;
- immutable election configuration;
- trusted-demo voter registration using election-scoped nullifiers and
  ephemeral voting addresses;
- proof-based registration calldata generation for relayer submission;
- dry-run/live script support for a dedicated registration relayer account;
- a direct ballot-commitment path for local contract testing;
- a real four-candidate BabyJubJub/Groth16 ballot-validity circuit, generated
  Solidity verifier, and proof-gated direct ballot submission;
- encrypted ballot package utilities;
- version-2 proof-compatible vote-package, aggregate-bound batch, receipt, and
  encrypted tally CLI flows;
- IPFS upload, batch manifest, and data-availability scripts;
- append-only batch commitments with nullifier-root continuity;
- a proof-verifier seam for future batch-validity submission;
- encrypted tally aggregation and real BabyJubJub 5-of-9 Shamir trustee
  shares with DLEQ correctness proofs;
- tally result/public-input hash binding; and
- a tally-verifier adapter that requires a real verifier contract before a
  result can be marked verified.

The repository also includes an adapter for the official Anon Aadhaar verifier
interface, an Anon Aadhaar registration-artifact builder, an ERC-4337 bundler
submission bridge, a deterministic biometric pass/fail simulation, and a
functional artifact-backed local dashboard. Live Anon Aadhaar proof material,
provider-issued Paymaster data, and Amoy transaction evidence remain external
deployment inputs; they are never replaced with fake evidence.

The version-2 canonical path uses BabyJubJub from the real ballot proof through
encrypted aggregation and threshold decryption. Real batch-recursion and tally
SNARK circuits remain stronger post-demo work. The revised Plan B explicitly
allows a trusted local batcher and verifier-hash tally phase, so these are not
misrepresented as completed trustless proofs.

## Important security boundary

The current batch contract records roots; it does not prove that every ballot
inside a batch is valid or available. Until a batch-validity and
nullifier-state proof is implemented, the batcher is trusted and the project
must be presented as a testnet demonstration—not a production election
system.

## Requirements

- Node.js 22.13 or newer
- npm 10 or newer

## Setup

```bash
npm install
cp .env.example .env
npm run compile
npm test
```

Generate a new real ballot proof with the committed public testnet proving
artifacts:

```bash
npm run circuit:input:ballot -- ./ballot-input.json 1
npm run proof:ballot -- ./ballot-input.json ./ballot-proof-output
```

Build the proof-compatible package, batch, and tally artifacts:

```bash
npm run build:vote-package:v2 -- descriptor.json vote-package-v2.json
npm run build:batch:v2 -- batch-input.json batch-artifact-v2.json
npm run build:tally:v2 -- tally-input.json encrypted-tally-v2.json
npm run finalize:tally:v2 -- finalize-config.json threshold-output
```

Run the complete local cryptographic demo and dashboard:

```bash
npm run demo:serve
```

Then open `http://127.0.0.1:8080`. This regenerates real ballot-proof packages,
the aggregate-bound batch, receipts, and the 5-of-9 threshold result before
serving the UI.

To regenerate the proving key, verifier, and matching test fixture, run
`npm run circuit:setup:ballot`. This performs a fresh local testnet ceremony;
it is not a production multi-party key ceremony. The public proving key and
WASM are committed so normal demo proof generation does not require rerunning
that ceremony.

Local deployment:

```bash
npm run deploy:local
```

Polygon Amoy deployment:

```bash
npm run deploy:amoy
```

Amoy uses chain ID `80002` and POL as its gas token.
For real verifier-address parameters, copy and edit
[ignition/parameters.example.json](ignition/parameters.example.json), then run:

```bash
npx hardhat ignition deploy ignition/modules/VotingSystem.ts --network amoy --parameters ignition/parameters.example.json
```

Final-demo readiness check:

```bash
npm run check:readiness -- path/to/readiness.json
```

See [docs/demo-readiness.md](docs/demo-readiness.md) for the artifact format.

Local deterministic demo fixture:

```bash
npm run demo:fixture -- ./demo-output
```

This fixture is useful for script demos, but its proof bytes are placeholders.

For the steps that require external Amoy, Anon Aadhaar, IPFS, or bundler
credentials, follow [docs/live-amoy-checklist.md](docs/live-amoy-checklist.md).

Runbook and alignment review:

- [docs/demo-runbook.md](docs/demo-runbook.md)
- [docs/research-alignment-review.md](docs/research-alignment-review.md)

## Repository layout

```text
contracts/   Solidity contracts and verifier interfaces
ignition/    Repeatable deployment modules
test/        Contract tests
circuits/    Real ballot circuit and planned batch/tally circuits
packages/    Shared cryptography, proof-input, and Merkle utilities
frontend/    Functional local demo UI and future production frontend
docs/        Architecture, scope, and implementation roadmap
```

See [docs/architecture.md](docs/architecture.md) for trust boundaries and
[docs/implementation-roadmap.md](docs/implementation-roadmap.md) for the next
build milestones.
