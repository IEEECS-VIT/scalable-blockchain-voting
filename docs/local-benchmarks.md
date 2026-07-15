# Reproducible local benchmarks

These numbers are engineering evidence from Hardhat local execution. They are
gas units, not rupees, dollars, POL, or mainnet cost estimates.

## Gas regression result

Run:

```bash
npx hardhat test --no-compile test/GasBenchmark.ts
```

Measured on the current local build:

| Operation | Local gas |
| --- | ---: |
| Direct V3 submission with real unified Groth16 verification | 448,831 |
| Trusted batch commitment, declared size 64 | 213,060 |
| Trusted batch commitment, declared size 1,024 | 213,048 |
| Trusted batch commitment, declared size 4,096 | 213,060 |

The batch transaction remains effectively constant because package validation,
encrypted aggregation, and nullifier checks occur off-chain. This is useful
amortization evidence, but the current batch is trusted. Dividing 213,060 by
4,096 gives roughly 52 gas per represented vote before data availability,
proof aggregation, relayer, and network costs. That quotient must not be
presented as a complete production cost.

## Synthetic ingestion result

Run:

```bash
npm run benchmark:scale -- 10000
```

The command measures deterministic nullifier generation and local accumulator
insertion, then projects commitment transaction counts for several batch sizes.
Its output is explicitly labeled
`synthetic-nullifier-ingestion-not-real-proof-generation` and excludes Groth16
proof generation/verification, IPFS, networking, and relayer latency.

Use this benchmark for regression and architecture discussion only. A credible
scale claim requires repeated runs on specified hardware with real proofs,
storage, network topology, failure injection, and percentile latency reporting.
