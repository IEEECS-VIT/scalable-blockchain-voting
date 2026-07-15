# V3 research improvement report

## Honest outcome

V3 is a substantially stronger research demo than the original Plan B MVP.
It now demonstrates, with real local cryptography, that an eligible credential
can authorize exactly one encrypted ballot without publishing the credential or
choice. It also provides proof-checked batching artifacts, inclusion receipts,
threshold tally shares, and omission-accountability claims.

It is not a production national-election system. Recursive batch verification,
an on-chain tally proof, production distributed key generation, audited
credential issuance, sustained load evidence, and live infrastructure remain
outside the completed local demo.

## Problem-by-problem result

| Research problem | What V3 demonstrates | Honest status |
| --- | --- | --- |
| Gas cost | One constant-size batch commitment can represent thousands of off-chain packages. Local measurement: 448,831 gas for direct unified-proof submission versus about 213,060 gas for one trusted batch commitment. | Strong architecture demo; not trustless national-scale proof until recursive aggregation exists. |
| Privacy | BabyJubJub EC-ElGamal encrypts every choice. A unified Groth16 proof validates membership, election nullifier, one-hot selection, and encryption without exposing credential secret, Merkle path, choice, or randomness. | Solved for the local cryptographic statement; endpoint compromise, traffic analysis, coercion, and audited setup remain external threats. |
| Identity | A 24-level eligibility-root membership proof authorizes a committed credential. The election nullifier is derived inside the circuit, so one credential cannot create two accepted nullifiers for the same election without breaking proof soundness. | Cryptographic one-credential-one-vote is demonstrated; trustworthy real-world credential issuance and revocation are not solved by blockchain code alone. |
| Scalability | Vote packages are content-addressed, proof-checked off-chain, deterministically batched, and represented on-chain by constant-size roots. Synthetic ingestion and transaction-count projections are reproducible. | Pipeline scales structurally; real nationwide proof generation, recursive verification, storage, networking, and burst tests are not complete. |
| Verifiability | Voters receive Merkle inclusion receipts. The tally binds accepted manifests, encrypted aggregate, DLEQ trustee shares, eligibility root, and result hash. Signed batcher receipts can open public omission claims resolved by committed inclusion proofs. | Strong local end-to-end audit trail; final batch validity and tally correctness are not yet verified by trustless on-chain proofs. |

## What changed in V3

1. `eligible_ballot.circom` combines private eligibility membership, election
   nullifier derivation, package commitment, and encrypted one-hot ballot
   validity into one proof with 23 public inputs.
2. `EligibilityRootRegistry` versions the active voter-roll commitment without
   placing identity records on-chain, then permanently freezes it before votes
   are accepted.
3. V3 package and batch schemas bind the eligibility root, real proof public
   inputs, encrypted aggregate, candidate list, election key, nullifier
   transition, and content-addressed leaves.
4. Every V3 package proof is cryptographically checked before a batch artifact
   is emitted. The artifact explicitly reports that recursive proof aggregation
   is not implemented.
5. Trustee operations are separated: a private ceremony workspace writes one
   private file per trustee; each trustee emits one public DLEQ-proved share;
   the combiner never receives the election private key or trustee private
   shares.
6. `BatcherReceiptRegistry` adds signed intake deadlines, public omission
   claims, and Merkle-based claim resolution against committed batch roots.
7. The V3 dashboard is generated entirely from public evidence and tests that
   no witness or trustee secret is served.

The 24-level tree supports up to 16,777,216 credential slots per election
instance. A larger deployment must use constituency/district election IDs and
roots (with the district bound into `electionId`) or increase/review the circuit
depth. The current demo does not claim one unsharded root for 960 million voters.

## Novelty assessment

The individual building blocks—Merkle eligibility proofs, nullifiers,
ElGamal-style encrypted ballots, Groth16, batching, threshold decryption, DLEQ
proofs, and EIP-712 receipts—are established techniques. The defensible project
contribution is their carefully bound, metadata-minimal V3 composition and its
machine-readable separation of real proof, off-chain verification, mock, and
external evidence.

That is meaningful implementation and systems-design novelty for a student
research demo. It is not evidence that the idea has never been published, and
it is not a patent-novelty opinion. Academic reviewers, a competition panel, or
a patent examiner must judge novelty against a formal prior-art search.

## Remaining research gates

1. Recursively aggregate the unified ballot proofs and prove the nullifier-state
   transition before `submitBatchWithProof` can remove batcher trust.
2. Prove encrypted aggregation, threshold-share validity, and result decoding in
   a verifier-compatible tally circuit.
3. Replace the demo Shamir dealer with an audited DKG protocol and operationally
   independent trustees.
4. Run a real credential issuance/revocation pilot, independent security audit,
   coercion analysis, and accessibility/usability study.
5. Produce measured proof-generation, verification, IPFS, relayer, and network
   results at progressively larger loads.
6. Add live Amoy, Anon Aadhaar test-mode, IPFS persistence, and sponsored
   ERC-4337 evidence without storing sensitive identity material.
