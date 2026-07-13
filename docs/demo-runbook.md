# Complete demo runbook

## 1. Verify the repository

```bash
source ~/.nvm/nvm.sh
nvm use 22
npm run typecheck
npm run test:crypto
npm test
npx hardhat test --no-compile
```

All enabled tests must pass. The optional IPFS upload test is skipped when the
environment does not allow a localhost listener; enable it with
`RUN_IPFS_UPLOAD_SCRIPT_TEST=1`.

## 2. Run the complete local proof flow

```bash
npm run demo:serve
```

Open `http://127.0.0.1:8080`. The command first regenerates:

- two real Groth16 proof-bound BabyJubJub vote packages;
- one deterministic aggregate-bound batch and two inclusion receipts;
- the encrypted aggregate; and
- five DLEQ-verified shares from a deterministic 5-of-9 test keyset, producing
  tally `[0, 1, 1, 0]`.

Use the Registration page to show biometric failure first and success second.
The visible audit JSON demonstrates that no fingerprint, image, Aadhaar number,
or raw biometric field is retained. Then inspect the proof package, receipt,
threshold result, and public status panel.

## 3. Generate individual artifacts

```bash
npm run circuit:input:ballot -- ./ballot-input.json 1
npm run proof:ballot -- ./ballot-input.json ./ballot-proof-output
npm run build:vote-package:v2 -- descriptor.json vote-package-v2.json
npm run build:batch:v2 -- batch-input.json batch-artifact-v2.json
npm run build:tally:v2 -- tally-input.json encrypted-tally-v2.json
npm run finalize:tally:v2 -- finalize-config.json threshold-output
```

Regenerate the local testnet ceremony only when the circuit changes:

```bash
npm run circuit:setup:ballot
```

The committed ceremony is appropriate for this demonstration, not a production
multi-party setup.

## 4. Failure demonstrations

The tests and scripts reject:

- malformed one-hot ballots or changed ciphertext bindings;
- duplicate registration and ballot nullifiers;
- duplicate batch nullifiers and broken accumulator continuity;
- missing or modified content-addressed packages;
- changed inclusion paths;
- missing or tampered trustee shares/DLEQ proofs;
- tally publication without a configured verifier;
- Anon Aadhaar public signals that do not bind the requested registration; and
- ERC-4337 operations without provider-issued Paymaster data.

## 5. Live Amoy extension

Follow [live-amoy-checklist.md](live-amoy-checklist.md). Do not commit `.env`,
private keys, identity proofs containing sensitive data, or provider secrets.

## Honest presentation wording

> Zero-cost privacy-preserving voting demo with real BabyJubJub/Groth16 ballot
> proofs, deterministic content-addressed batching and receipts, and real
> off-chain 5-of-9 threshold decryption. Anon Aadhaar and ERC-4337 adapters are
> implemented; live Amoy/provider evidence is deployment-specific. The local
> Plan B batcher remains trusted until recursive batch and tally SNARKs are
> added.
