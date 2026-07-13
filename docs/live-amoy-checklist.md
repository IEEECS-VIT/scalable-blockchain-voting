# Live Amoy and provider checklist

Everything below changes external state or requires credentials. The repository
supplies the safe commands and validation; the user supplies testnet accounts,
proofs, sponsorship data, and provider endpoints.

## 1. Prepare secrets

```bash
cp .env.example .env
```

Set `AMOY_RPC_URL` and a faucet-funded, testnet-only
`DEPLOYER_PRIVATE_KEY`. Optionally set a separate `RELAYER_PRIVATE_KEY`,
`IPFS_API_URL`, and `IPFS_API_AUTH_HEADER`. Never commit `.env`.

## 2. Deploy the Anon Aadhaar adapter

Copy `ignition/anon-aadhaar.parameters.example.json`, set the official
test-mode contract address, matching election ID, and desired proof age, then:

```bash
npm run deploy:anon-adapter:amoy -- --parameters ignition/anon-aadhaar.parameters.json
```

Record the adapter address. A zero official-verifier address will fail closed
and is not usable evidence.

## 3. Deploy the voting system

Copy `ignition/parameters.example.json`. Set the same election ID, the exact
four-candidate list hash and public-key hash, the adapter address as
`eligibilityVerifier`, and real timestamps. Leave batch/tally verifier
addresses zero unless genuine verifier contracts are deployed.

```bash
npx hardhat ignition deploy ignition/modules/VotingSystem.ts \
  --network amoy \
  --parameters ignition/parameters.json
```

Save the contract addresses and PolygonScan links.

## 4. Register through Anon Aadhaar and a relayer

Export the test-mode Anon Aadhaar proof/public signals from the official client,
build the contract-bound artifact, inspect it, then dry-run before sending:

```bash
npm run build:anon-registration -- anon-descriptor.json registration-artifact.json
npm run submit:registration-relayer -- registration-artifact.json --dry-run
npm run submit:registration-relayer -- registration-artifact.json
```

Do not commit personally identifying proof inputs.

## 5. Store vote packages

```bash
npm run upload:vote-package -- vote-package-v2.json
npm run check:data -- batch-input.json
```

Keep the returned content ID and verify retrieval before committing a batch.

## 6. Send one sponsored ERC-4337 action

Obtain a fully sponsored v0.6 or v0.7 UserOperation from the selected
Paymaster provider. Its sponsorship fields must be nonzero.

```bash
npm run submit:userop -- sponsored-userop.json userop-evidence.json
npm run submit:userop -- sponsored-userop.json userop-evidence.json --send
```

The first command estimates only. The second sends and polls the bundler
receipt. Commit the non-sensitive evidence JSON or record its transaction hash
and explorer link.

## 7. Final evidence check

Populate the readiness descriptor described in `docs/demo-readiness.md`, then:

```bash
npm run check:readiness -- readiness.json
```

A passing local test suite is not a substitute for these live transaction and
provider records.
