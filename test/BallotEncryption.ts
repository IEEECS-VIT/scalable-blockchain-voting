import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  aggregateBallotCiphertexts,
  createElectionKeyPair,
  decryptAggregatedTally,
  decryptBallotSelection,
  encryptBallotSelection,
  hashElectionPublicKey,
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
