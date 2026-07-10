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
- a ballot-validity verifier seam for proof-gated direct ballot submission;
- encrypted ballot package utilities;
- IPFS upload, batch manifest, and data-availability scripts;
- append-only batch commitments with nullifier-root continuity;
- a proof-verifier seam for future batch-validity submission;
- encrypted tally aggregation and local threshold-share tally helpers;
- tally result/public-input hash binding; and
- a tally-verifier adapter that requires a real verifier contract before a
  result can be marked verified.

The biometric screen, Anon Aadhaar integration, real ballot/batch/tally
circuits, ERC-4337 sponsorship, and frontend are not implemented yet.

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

## Repository layout

```text
contracts/   Solidity contracts and verifier interfaces
ignition/    Repeatable deployment modules
test/        Contract tests
circuits/    Future Circom circuits
packages/    Future shared cryptography and Merkle utilities
frontend/    Future Next.js application
docs/        Architecture, scope, and implementation roadmap
```

See [docs/architecture.md](docs/architecture.md) for trust boundaries and
[docs/implementation-roadmap.md](docs/implementation-roadmap.md) for the next
build milestones.
