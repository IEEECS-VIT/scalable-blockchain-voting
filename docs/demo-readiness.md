# Demo readiness gate

`npm run check:readiness -- path/to/readiness.json` is the final-demo honesty
gate. It is intentionally strict: mock artifacts and missing proof files keep
the demo blocked.

The checker expects this shape:

```json
{
  "eligibility": {
    "mock": false,
    "verifierAddress": "0x..."
  },
  "ballotValidity": {
    "mock": false,
    "verifierAddress": "0x...",
    "circuitPath": "artifacts/ballot_validity.circom",
    "wasmPath": "artifacts/ballot_validity.wasm",
    "zkeyPath": "artifacts/ballot_validity_final.zkey",
    "verificationKeyPath": "artifacts/ballot_validity_vkey.json"
  },
  "batchValidity": {
    "mock": false,
    "verifierAddress": "0x...",
    "circuitPath": "artifacts/batch_validity.circom",
    "wasmPath": "artifacts/batch_validity.wasm",
    "zkeyPath": "artifacts/batch_validity_final.zkey",
    "verificationKeyPath": "artifacts/batch_validity_vkey.json"
  },
  "tallyProof": {
    "mock": false,
    "verifierAddress": "0x...",
    "circuitPath": "artifacts/tally_proof.circom",
    "wasmPath": "artifacts/tally_proof.wasm",
    "zkeyPath": "artifacts/tally_proof_final.zkey",
    "verificationKeyPath": "artifacts/tally_proof_vkey.json"
  },
  "sponsoredUserOperation": {
    "mock": false,
    "paymasterAddress": "0x...",
    "userOperationHash": "0x...",
    "transactionHash": "0x..."
  },
  "frontend": {
    "mock": false,
    "pages": [
      "registration",
      "voting",
      "receipt",
      "batch",
      "tally",
      "verification"
    ]
  }
}
```

Passing this script does not audit the cryptography. It only verifies that the
demo is no longer relying on missing files, zero verifier addresses, mocked
proof systems, or absent frontend pages.

For status reporting without failing your shell command, run:

```bash
npm run check:readiness -- path/to/readiness.json --allow-blocked
```
