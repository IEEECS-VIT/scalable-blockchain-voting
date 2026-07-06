import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  aggregateBallotCiphertexts,
  createTallyDecryptionShare,
  createElectionKeyPair,
  createThresholdElectionKeyShares,
  decryptAggregatedTally,
  decryptAggregatedTallyWithShares,
  decryptBallotSelection,
  encryptBallotSelection,
  hashElectionPublicKey,
  verifyTallyDecryptionShare,
  type TallyDecryptionShareV1,
} from "../packages/crypto/src/index.js";

const privateKey =
  "0x0000000000000000000000000000000000000000000000000000000000000007";
const randomness = [
  "0x0000000000000000000000000000000000000000000000000000000000000011",
  "0x0000000000000000000000000000000000000000000000000000000000000012",
  "0x0000000000000000000000000000000000000000000000000000000000000013",
] as const;

describe("ballot encryption utilities", function () {
  it("derives an election key pair and encrypts a single selected candidate", function () {
    const electionKey = createElectionKeyPair(privateKey);
    const ciphertext = encryptBallotSelection({
      electionPublicKey: electionKey.publicKey,
      candidateCount: 3,
      selectedIndex: 1,
      randomness,
    });

    assert.equal(
      ciphertext.electionPublicKeyHash,
      hashElectionPublicKey(electionKey.publicKey),
    );
    assert.deepEqual(
      decryptBallotSelection({
        privateKey: electionKey.privateKey,
        ciphertext,
      }),
      [0, 1, 0],
    );
  });

  it("encrypts the same selection differently when randomness changes", function () {
    const electionKey = createElectionKeyPair(privateKey);
    const first = encryptBallotSelection({
      electionPublicKey: electionKey.publicKey,
      candidateCount: 3,
      selectedIndex: 2,
      randomness,
    });
    const second = encryptBallotSelection({
      electionPublicKey: electionKey.publicKey,
      candidateCount: 3,
      selectedIndex: 2,
      randomness: [
        "0x0000000000000000000000000000000000000000000000000000000000000021",
        "0x0000000000000000000000000000000000000000000000000000000000000022",
        "0x0000000000000000000000000000000000000000000000000000000000000023",
      ],
    });

    assert.notDeepEqual(first.points, second.points);
    assert.deepEqual(decryptBallotSelection({ privateKey, ciphertext: first }), [0, 0, 1]);
    assert.deepEqual(decryptBallotSelection({ privateKey, ciphertext: second }), [0, 0, 1]);
  });

  it("homomorphically aggregates encrypted ballots for local demo tally checks", function () {
    const electionKey = createElectionKeyPair(privateKey);
    const ballots = [0, 2, 2, 1].map((selectedIndex, index) =>
      encryptBallotSelection({
        electionPublicKey: electionKey.publicKey,
        candidateCount: 3,
        selectedIndex,
        randomness: randomness.map(
          (value) =>
            `0x${(BigInt(value) + BigInt(index * 10)).toString(16).padStart(64, "0")}`,
        ) as readonly `0x${string}`[],
      }),
    );

    const aggregate = aggregateBallotCiphertexts(ballots);

    assert.deepEqual(
      decryptAggregatedTally({
        privateKey: electionKey.privateKey,
        ciphertext: aggregate,
        maxVotes: ballots.length,
      }),
      [1, 1, 2],
    );
  });

  it("decrypts an aggregate with threshold shares and DLEQ share proofs", function () {
    const thresholdKey = createThresholdElectionKeyShares({
      privateKey,
      threshold: 2,
      trusteeCount: 3,
      coefficients: [
        "0x000000000000000000000000000000000000000000000000000000000000001d",
      ],
    });
    const ballots = [0, 2, 2, 1].map((selectedIndex, index) =>
      encryptBallotSelection({
        electionPublicKey: thresholdKey.publicKey,
        candidateCount: 3,
        selectedIndex,
        randomness: randomness.map(
          (value) =>
            `0x${(BigInt(value) + BigInt(index * 10)).toString(16).padStart(64, "0")}`,
        ) as readonly `0x${string}`[],
      }),
    );
    const aggregate = aggregateBallotCiphertexts(ballots);
    const proofNonces = [
      "0x0000000000000000000000000000000000000000000000000000000000000031",
      "0x0000000000000000000000000000000000000000000000000000000000000032",
      "0x0000000000000000000000000000000000000000000000000000000000000033",
    ] as const;
    const shares = thresholdKey.shares.slice(0, 2).map((share, index) =>
      createTallyDecryptionShare({
        trusteeIndex: share.trusteeIndex,
        privateShare: share.privateShare,
        ciphertext: aggregate,
        proofNonces: proofNonces.map(
          (nonce) =>
            `0x${(BigInt(nonce) + BigInt(index * 10)).toString(16).padStart(64, "0")}`,
        ) as readonly `0x${string}`[],
      }),
    );

    assert.equal(thresholdKey.publicKeyHash, hashElectionPublicKey(thresholdKey.publicKey));
    assert.equal(verifyTallyDecryptionShare({ ciphertext: aggregate, share: shares[0]! }), true);
    assert.deepEqual(
      decryptAggregatedTallyWithShares({
        ciphertext: aggregate,
        shares,
        threshold: 2,
        maxVotes: ballots.length,
      }),
      [1, 1, 2],
    );
  });

  it("rejects missing or tampered threshold decryption shares", function () {
    const thresholdKey = createThresholdElectionKeyShares({
      privateKey,
      threshold: 2,
      trusteeCount: 3,
      coefficients: [
        "0x000000000000000000000000000000000000000000000000000000000000001d",
      ],
    });
    const aggregate = aggregateBallotCiphertexts([
      encryptBallotSelection({
        electionPublicKey: thresholdKey.publicKey,
        candidateCount: 3,
        selectedIndex: 1,
        randomness,
      }),
      encryptBallotSelection({
        electionPublicKey: thresholdKey.publicKey,
        candidateCount: 3,
        selectedIndex: 2,
        randomness: [
          "0x0000000000000000000000000000000000000000000000000000000000000041",
          "0x0000000000000000000000000000000000000000000000000000000000000042",
          "0x0000000000000000000000000000000000000000000000000000000000000043",
        ],
      }),
    ]);
    const validShares = thresholdKey.shares.slice(0, 2).map((share) =>
      createTallyDecryptionShare({
        trusteeIndex: share.trusteeIndex,
        privateShare: share.privateShare,
        ciphertext: aggregate,
      }),
    );
    const tamperedShare: TallyDecryptionShareV1 = {
      ...validShares[0]!,
      decryptionSharePoints: [
        validShares[1]!.decryptionSharePoints[0]!,
        ...validShares[0]!.decryptionSharePoints.slice(1),
      ],
    };

    assert.throws(() =>
      decryptAggregatedTallyWithShares({
        ciphertext: aggregate,
        shares: [validShares[0]!],
        threshold: 2,
        maxVotes: 2,
      }),
    );
    assert.equal(verifyTallyDecryptionShare({ ciphertext: aggregate, share: tamperedShare }), false);
    assert.throws(() =>
      decryptAggregatedTallyWithShares({
        ciphertext: aggregate,
        shares: [tamperedShare, validShares[1]!],
        threshold: 2,
        maxVotes: 2,
      }),
    );
  });

  it("rejects invalid selections and wrong decryption keys", function () {
    const electionKey = createElectionKeyPair(privateKey);
    const ciphertext = encryptBallotSelection({
      electionPublicKey: electionKey.publicKey,
      candidateCount: 3,
      selectedIndex: 0,
      randomness,
    });

    assert.throws(() =>
      encryptBallotSelection({
        electionPublicKey: electionKey.publicKey,
        candidateCount: 3,
        selectedIndex: 3,
        randomness,
      }),
    );
    assert.throws(() =>
      decryptBallotSelection({
        privateKey:
          "0x0000000000000000000000000000000000000000000000000000000000000008",
        ciphertext,
      }),
    );
  });
});
