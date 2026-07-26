# Gas Benchmarking Results

Measured on Hardhat local EVM (cancun). All values are gas units.

## Operations

| Operation | Gas |
|-----------|-----|
| Direct V3 eligible ballot (real Groth16 proof) | 448,831 |
| Batch commitment, 64 ballots | 213,060 |
| Batch commitment, 1,024 ballots | 213,048 |
| Batch commitment, 4,096 ballots | 213,060 |

## Observations

**Batch commitment is constant-cost.** Gas for `submitBatch` does not change
with batch size because per-ballot validation (proof verification, nullifier
uniqueness, ciphertext aggregation) happens off-chain. The on-chain transaction
only stores Merkle roots and the manifest digest. At 213,060 / 4,096 ≈ 52 gas
per represented ballot, but the batch path remains trusted.

**Direct V3 verification is the expensive path.** Each `submitEligibleBallot`
at 448,831 gas includes a full Groth16 pairing check. This motivates the batch
path for scale.

## Scaling projections

| Batch size | TX count for 10k votes | TX count for 100k votes |
|------------|------------------------|-------------------------|
| 64 | 157 | 1,563 |
| 256 | 40 | 391 |
| 1,024 | 10 | 98 |
| 4,096 | 3 | 25 |

From `npm run benchmark:scale -- <N>`. Excludes proof generation, IPFS,
network, and relayer costs.

## How to reproduce

```bash
npm test
npm run benchmark:scale -- 10000
```

## Limitations

- Local Hardhat only; Amoy or mainnet may differ.
- Batch cost is O(1) in batch size by design — feature of trusted model.
- Real Groth16 proof generation adds 30-120 seconds per proof.
- Data-availability (IPFS) cost not reflected.
