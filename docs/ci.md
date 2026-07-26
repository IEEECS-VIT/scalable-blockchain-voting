# CI Pipeline

GitHub Actions runs on push and pull request to `main`.

## Workflow: `.github/workflows/ci.yml`

| Step | What it verifies | Notes |
|------|------------------|-------|
| `npm install` | Dependency resolution | Cached via `setup-node` |
| `npm run typecheck` | TypeScript compilation | Catches type errors before runtime |
| `npm run compile` | Solidity compilation (Hardhat) | Compiles all `.sol` files with solc 0.8.28 |
| `npm run circuit:compile:eligible-ballot` | Circom compilation | Builds constraint system + WASM (~5s) |
| `npm test` | Hardhat contract tests | 85+ tests including proof verification |
| `npm run test:crypto` | Crypto/script tests (node:test) | TypeScript pipeline tests |
| Readiness annotation | Non-blocking demo check | Reports mock status, not a failure |

## What CI does NOT do

1. **Full trusted-setup ceremony** — Only needed when circuit changes; committed artifacts suffice.
2. **Live deployment** — Requires RPC keys unavailable in CI.
3. **Real-proof generation** — Snarkjs adds minutes without regression value.
4. **IPFS upload** — Requires local IPFS/gateway.
5. **ERC-4337 bundler submission** — Requires provider-issued Paymaster data.

These match the project's documented trust boundaries.
