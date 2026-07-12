# Circuits

Implemented:

- `ballot_validity.circom`: a real four-candidate Groth16 circuit proving a
  one-hot selection and the complete BabyJubJub EC-ElGamal encryption
  equations. It binds election ID, candidate-list hash, ballot nullifier,
  election public key, ciphertext points, and a Poseidon package commitment.

Planned:

- `batch_validity.circom`: prove ballot validity, nullifier uniqueness, state
  transition, and aggregate consistency for a committed batch.
- `tally_proof.circom`: bind accepted batches, aggregate ciphertext,
  decryption shares, election configuration, and published totals.

The public testnet proving key, WASM, verification key, generated verifier,
and deterministic proof fixture are committed so a fresh clone can generate
and verify proofs immediately. Run `npm run circuit:setup:ballot` only to
perform a new local ceremony and refresh all verifier-bound artifacts. Ceremony
transcripts remain ignored. This is not a production multi-party ceremony.

`BallotGroth16VerifierAdapter` decodes the proof, recomputes the public-input
hash, and checks that the proof's election, nullifier, and Poseidon package
commitment match the values accepted by `VotingContract`.

The TypeScript batching utilities output `batchPublicInputsHash`, which is the
intended public-input binding for the future batch-validity/state-transition
circuit. `BatchCommitment.submitBatchWithProof` can store that hash after a
configured verifier accepts a proof. This fixes the integration seam; it is
not a proof implementation.
