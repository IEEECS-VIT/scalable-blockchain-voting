# Shared cryptography and batching utilities

This package contains the shared TypeScript utilities that the future frontend,
batcher, IPFS scripts, and circuits must agree on.

Implemented now:

- secp256k1 EC-ElGamal-style encrypted vote vectors;
- deterministic public-key hashing;
- ballot-proof public-input hashing bound to election ID, candidate list,
  nullifier, and ciphertext;
- registration public-input hashing bound to election ID, identity nullifier,
  and ephemeral voting key;
- local demo decryption and homomorphic aggregation helpers;
- strict `VotePackageV1` validation;
- no timestamp, device, browser, or client-version metadata in stored vote
  packages;
- deterministic vote-package digests;
- Merkle roots and inclusion receipts for content-addressed vote packages;
- duplicate-nullifier rejection; and
- deterministic batch manifest digests that match the fields committed by
  `BatchCommitment`.

Not implemented yet:

- real ballot-validity proof generation;
- real batch-validity/nullifier-state circuit; or
- IPFS upload/download.

The current code is intentionally a serialization and commitment layer. It is
the foundation that real proof systems plug into next; it is not a replacement
for the circuits or threshold decryption.
