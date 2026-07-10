# Circuits

Planned circuits:

- `ballot_validity.circom`: prove one valid candidate selection and bind the
  proof to the election, ciphertext, and ballot nullifier.
- `batch_validity.circom`: prove ballot validity, nullifier uniqueness, state
  transition, and aggregate consistency for a committed batch.
- `tally_proof.circom`: bind accepted batches, aggregate ciphertext,
  decryption shares, election configuration, and published totals.

No circuit is implemented yet. A hash placeholder must not be presented as a
SNARK.

The TypeScript crypto utilities output ballot public-input hashes for the
future ballot-validity circuit. `VotingContract.submitBallotWithProof` can
store that hash after a configured verifier accepts a proof. This fixes the
adapter seam; it is not a proof implementation.

The TypeScript batching utilities output `batchPublicInputsHash`, which is the
intended public-input binding for the future batch-validity/state-transition
circuit. `BatchCommitment.submitBatchWithProof` can store that hash after a
configured verifier accepts a proof. This fixes the integration seam; it is
not a proof implementation.
