# Research alignment review

This review compares the implementation with Revised Plan B v2.0 and keeps
repository-local completion separate from live external evidence.

## Verdict

The zero-cost local V3 demonstration is complete and exceeds the Plan B MVP in
its eligibility, ballot, accountability, and threshold cryptography. The same repository can be taken to
Amoy using the included deployment and submission bridges, but a live Anon
Aadhaar proof, faucet-funded deployer, IPFS provider, Paymaster-issued
UserOperation, transaction hashes, and explorer links cannot be committed in
advance or simulated as real evidence.

Plan B explicitly permits a mocked eligibility proof, trusted local batcher,
test trustees, Paymaster simulation, a simplified nullifier design, and a
verifier-hash tally phase. This implementation goes further with a real
BabyJubJub/Groth16 ballot proof, an official Anon Aadhaar contract adapter, and
real 5-of-9 DLEQ-verified threshold decryption. V3 goes further again: a single
real proof now binds private eligibility membership, election nullifier
derivation, encrypted ballot validity, and the exact root-bound package.

## Acceptance checklist

| Plan B condition | Evidence in this repository | Status |
| --- | --- | --- |
| Biometric-gated registration | Interactive deterministic pass/fail screen; audit retains no biometric fields | Complete simulation |
| Privacy | Unified private membership/ballot proof, metadata-minimal packages, encrypted choices | Complete cryptographic demo; endpoint/coercion risks remain |
| Election identity | Election ID is part of registration and ballot bindings | Complete |
| Encryption | BabyJubJub EC-ElGamal ciphertexts | Complete |
| Ballot validity | Real unified eligibility/nullifier/one-hot encryption Groth16 circuit and Solidity verifier | Complete |
| Double voting | Nullifier derived from private credential inside proof plus direct/batch duplicate checks | Complete local statement; batch transition remains trusted |
| Batching | Every real proof checked; root/candidate/key/package/aggregate/nullifier bindings | Complete off-chain verification; trusted commitment |
| Inclusion | Tested Merkle receipts plus signed omission claims and committed resolution | Complete local accountability, not guaranteed liveness |
| Tally | Homomorphic aggregation and separately generated 5-of-9 DLEQ shares | Complete local off-chain tally |
| Public verification | Artifact dashboard, verifier scripts, hashes, and strict readiness gate | Complete locally |
| Zero cost | Local generation plus free-testnet configuration | Complete locally; live services require user accounts/faucet |

## Novel and defensible aspects

- The unified V3 proof binds the active eligibility root, private credential
  membership, election-derived nullifier, election ID, candidate-list hash,
  public key, every ciphertext point, and exact package commitment.
- The V3 package remains on BabyJubJub through
  deterministic batching, encrypted aggregation, and threshold decryption;
  there is no curve-switch shortcut in the canonical path.
- Five independently emitted DLEQ-proved trustee contributions can decrypt a 5-of-9 tally without
  reconstructing the private key in the combiner.
- Stored vote packages deliberately omit timestamps, browser versions, device
  identifiers, and client metadata, reducing avoidable voter fingerprinting.
- The aggregate ciphertext is committed into the batch artifact, making a
  tally substitution detectable even before a future recursive batch proof.
- The project treats trust-boundary honesty as a feature: mocks, hash bindings,
  external credentials, and real SNARKs have different machine-readable
  statuses and readiness gates.
- A batcher-signed deadline can create a public omission claim, and committed
  Merkle inclusion can resolve it without revealing a vote choice.

These are meaningful system-design contributions for a student testnet demo.
They are not, by themselves, a legal patent-novelty opinion or proof of academic
novelty. A competition panel, supervisor, paper reviewers, or patent examiner
ultimately judges novelty against prior art.

## Remaining external evidence

1. Generate an Anon Aadhaar test-mode proof and submit adapter-bound
   registration calldata through a relayer.
2. Deploy the contracts on Polygon Amoy and record addresses/transactions.
3. Upload package/manifest content to a real IPFS provider or local node.
4. Obtain Paymaster sponsorship data from a provider and send one ERC-4337
   UserOperation through the included bundler bridge.
5. Add the resulting explorer and content links to the dashboard evidence.

## Stronger post-demo research work

The trusted Plan B batch commitment can be removed only with recursive verification (or
an equivalent aggregation proof) that validates all private ballot proofs and
the nullifier-state transition. Likewise, the current real threshold tally is
verified off-chain; an audited tally circuit and generated verifier are needed
for trustless on-chain tally verification. These are production/research
extensions, not hidden claims of the current demo.
