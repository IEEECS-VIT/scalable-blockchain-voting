# Demo runbook

This runbook is for the current local/testnet demo state. It is intentionally
strict about what is real, what is mocked, and what is still blocked.

## 1. Verify the repository

Use Node 22:

```bash
source ~/.nvm/nvm.sh
nvm use 22
```

Run the full check set:

```bash
npm run typecheck
npm run test:crypto
npm test
npx hardhat test --no-compile
```

Expected current result:

```text
35 passing
1 skipped
```

The skipped test is the optional local IPFS HTTP listener test.

## 2. Generate a deterministic local fixture

```bash
npm run demo:fixture -- ./demo-output
```

Important files:

- `election.json`
- `registration-request-artifact.json`
- `vote-1.json`, `vote-2.json`, `vote-3.json`
- `batch-artifact.json`
- `tally-artifact.json`
- `decryption-share-1.json`, `decryption-share-2.json`
- `tally-result-artifact.json`

The fixture uses placeholder proof bytes. It is for local flow demonstration,
not proof verification.

## 3. Walk through the UI

Open:

```text
frontend/demo/index.html
```

The static demo UI includes:

- registration page;
- voting page;
- receipt page;
- batch page;
- tally page; and
- verification page.

Each page includes a visible trust-boundary or failure-demo label.

## 4. Registration relayer flow

Build relayer calldata:

```bash
npm run build:registration-request -- ./demo-output/registration-request-input.json
```

Dry-run relayer submission:

```bash
npm run submit:registration-relayer -- ./demo-output/registration-request-artifact.json --dry-run
```

Live relayer submission requires a dedicated testnet key:

```bash
RELAYER_PRIVATE_KEY=0x... RELAYER_RPC_URL=https://... npm run submit:registration-relayer -- ./demo-output/registration-request-artifact.json
```

Do not use a funded production key.

## 5. Batching flow

Build a batch manifest:

```bash
npm run build:batch -- ./demo-output/batch-input.json
```

Check data availability locally:

```bash
npm run check:data -- ./demo-output/batch-input.json
```

Optional gateway check:

```bash
CHECK_IPFS_FETCH=1 IPFS_GATEWAY_URL=https://ipfs.io/ipfs/ npm run check:data -- ./demo-output/batch-input.json
```

The trusted batch path is still trusted until a real batch-validity circuit is
implemented.

## 6. Tally flow

Build encrypted tally inputs:

```bash
npm run build:tally -- ./demo-output/tally-input.json
```

Build tally result/public-input hashes:

```bash
npm run build:tally-result -- ./demo-output/tally-result-input.json
```

The local tally uses threshold-style decryption shares and DLEQ-style share
checks. It is not an on-chain tally proof.

## 7. Readiness gate

For final-demo readiness:

```bash
npm run check:readiness -- path/to/readiness.json
```

If you want a non-failing status report:

```bash
npm run check:readiness -- path/to/readiness.json --allow-blocked
```

The final demo should stay blocked until real proof artifacts, verifier
addresses, a sponsored UserOperation, and frontend evidence are provided.

## What cannot be claimed yet

Do not claim:

- real Anon Aadhaar verification;
- real batch-validity/nullifier-state proof;
- real tally SNARK;
- real ERC-4337 sponsorship; or
- production election readiness.

Correct wording:

```text
Zero-cost testnet demo with one real BabyJubJub/Groth16 ballot-validity path,
encrypted batch artifacts, relayer-ready registration, batch commitments,
local threshold tally helpers, and a strict readiness gate for remaining
real-vs-mock artifacts.
```
