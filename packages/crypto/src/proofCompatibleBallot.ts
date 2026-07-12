import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

import { buildBabyjub, buildPoseidon } from "circomlibjs";
import {
  encodeAbiParameters,
  isHex,
  keccak256,
  parseAbiParameters,
  stringToHex,
  type Hex,
} from "viem";

export const PROOF_COMPATIBLE_CANDIDATE_COUNT = 4 as const;
export const PROOF_COMPATIBLE_BALLOT_SCHEME =
  "ec-elgamal-babyjubjub-affine-v1" as const;
export const SNARK_SCALAR_FIELD =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export const BABYJUB_SUBGROUP_ORDER =
  2736030358979909402780800718157159386076813972158567259207130577147503137n;

const PUBLIC_INPUT_DOMAIN = keccak256(
  stringToHex("SVB_BABYJUB_BALLOT_PUBLIC_INPUTS_V1"),
);

export type BabyJubPoint = readonly [x: bigint, y: bigint];

export type ProofCompatibleElectionKeyPair = {
  privateKey: bigint;
  publicKey: BabyJubPoint;
  publicKeyHash: Hex;
};

export type ProofCompatibleBallotCiphertext = {
  scheme: typeof PROOF_COMPATIBLE_BALLOT_SCHEME;
  electionPublicKeyHash: Hex;
  c1: readonly BabyJubPoint[];
  c2: readonly BabyJubPoint[];
};

export type ProofCompatibleBallotWitness = {
  electionId: bigint;
  candidateListHash: bigint;
  ballotNullifier: bigint;
  packageCommitment: bigint;
  electionPublicKey: readonly [string, string];
  c1: readonly (readonly [string, string])[];
  c2: readonly (readonly [string, string])[];
  selection: readonly string[];
  randomness: readonly string[];
};

export type ProofCompatibleBallotPublicSignals = readonly [
  bigint, bigint, bigint, bigint, bigint, bigint, bigint,
  bigint, bigint, bigint, bigint, bigint, bigint, bigint,
  bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint,
];

type BabyJub = Awaited<ReturnType<typeof buildBabyjub>>;

function normalizeScalar(value: bigint, label: string): bigint {
  assert.equal(value > 0n, true, `${label} must be greater than zero`);
  assert.equal(
    value < BABYJUB_SUBGROUP_ORDER,
    true,
    `${label} must be smaller than the BabyJubJub subgroup order`,
  );
  return value;
}

function randomScalar(): bigint {
  return (
    (BigInt(`0x${randomBytes(32).toString("hex")}`) %
      (BABYJUB_SUBGROUP_ORDER - 1n)) +
    1n
  );
}

function pointToBigInts(babyJub: BabyJub, point: readonly unknown[]): BabyJubPoint {
  return [
    BigInt(babyJub.F.toObject(point[0]).toString()),
    BigInt(babyJub.F.toObject(point[1]).toString()),
  ];
}

function hashPublicKey(publicKey: BabyJubPoint): Hex {
  return keccak256(
    encodeAbiParameters(parseAbiParameters("uint256[2] publicKey"), [publicKey]),
  );
}

export function bytes32ToSnarkField(value: Hex): bigint {
  assert.equal(
    isHex(value, { strict: true }) && value.length === 66,
    true,
    "value must be a bytes32 hex string",
  );
  return BigInt(value) % SNARK_SCALAR_FIELD;
}

export async function createProofCompatibleElectionKeyPair(
  privateKey = randomScalar(),
): Promise<ProofCompatibleElectionKeyPair> {
  const scalar = normalizeScalar(privateKey, "privateKey");
  const babyJub = await buildBabyjub();
  const publicKey = pointToBigInts(
    babyJub,
    babyJub.mulPointEscalar(babyJub.Base8, scalar),
  );
  return {
    privateKey: scalar,
    publicKey,
    publicKeyHash: hashPublicKey(publicKey),
  };
}

export async function encryptProofCompatibleBallot(params: {
  electionPublicKey: BabyJubPoint;
  selectedIndex: number;
  randomness?: readonly bigint[];
}): Promise<{
  ciphertext: ProofCompatibleBallotCiphertext;
  selection: readonly bigint[];
  randomness: readonly bigint[];
}> {
  assert.equal(
    Number.isInteger(params.selectedIndex) &&
      params.selectedIndex >= 0 &&
      params.selectedIndex < PROOF_COMPATIBLE_CANDIDATE_COUNT,
    true,
    "selectedIndex must identify one of the four circuit candidates",
  );
  if (params.randomness !== undefined) {
    assert.equal(
      params.randomness.length,
      PROOF_COMPATIBLE_CANDIDATE_COUNT,
      "randomness must include one scalar per candidate",
    );
  }

  const babyJub = await buildBabyjub();
  const publicKey = params.electionPublicKey.map((coordinate) =>
    babyJub.F.e(coordinate),
  );
  assert.equal(babyJub.inSubgroup(publicKey), true, "election public key is not in the BabyJubJub subgroup");

  const randomness = Array.from(
    { length: PROOF_COMPATIBLE_CANDIDATE_COUNT },
    (_, index) =>
      normalizeScalar(
        params.randomness?.[index] ?? randomScalar(),
        `randomness[${index}]`,
      ),
  );
  const selection = Array.from(
    { length: PROOF_COMPATIBLE_CANDIDATE_COUNT },
    (_, index) => (index === params.selectedIndex ? 1n : 0n),
  );
  const c1: BabyJubPoint[] = [];
  const c2: BabyJubPoint[] = [];

  for (let index = 0; index < PROOF_COMPATIBLE_CANDIDATE_COUNT; index += 1) {
    const firstPoint = babyJub.mulPointEscalar(babyJub.Base8, randomness[index]!);
    const sharedSecret = babyJub.mulPointEscalar(publicKey, randomness[index]!);
    const encryptedMessage = selection[index] === 1n
      ? babyJub.addPoint(sharedSecret, babyJub.Base8)
      : sharedSecret;
    c1.push(pointToBigInts(babyJub, firstPoint));
    c2.push(pointToBigInts(babyJub, encryptedMessage));
  }

  return {
    ciphertext: {
      scheme: PROOF_COMPATIBLE_BALLOT_SCHEME,
      electionPublicKeyHash: hashPublicKey(params.electionPublicKey),
      c1,
      c2,
    },
    selection,
    randomness,
  };
}

export async function buildProofCompatibleBallotWitness(params: {
  electionId: Hex;
  candidateListHash: Hex;
  ballotNullifier: Hex;
  electionPublicKey: BabyJubPoint;
  ciphertext: ProofCompatibleBallotCiphertext;
  selection: readonly bigint[];
  randomness: readonly bigint[];
}): Promise<ProofCompatibleBallotWitness> {
  assert.equal(params.selection.length, PROOF_COMPATIBLE_CANDIDATE_COUNT);
  assert.equal(params.randomness.length, PROOF_COMPATIBLE_CANDIDATE_COUNT);
  assert.equal(params.ciphertext.c1.length, PROOF_COMPATIBLE_CANDIDATE_COUNT);
  assert.equal(params.ciphertext.c2.length, PROOF_COMPATIBLE_CANDIDATE_COUNT);
  assert.equal(
    params.ciphertext.electionPublicKeyHash,
    hashPublicKey(params.electionPublicKey),
    "ciphertext election public key hash does not match",
  );

  const pointStrings = (points: readonly BabyJubPoint[]) =>
    points.map((point) => [point[0].toString(), point[1].toString()] as const);

  const electionId = bytes32ToSnarkField(params.electionId);
  const candidateListHash = bytes32ToSnarkField(params.candidateListHash);
  const ballotNullifier = bytes32ToSnarkField(params.ballotNullifier);
  const publicStatement = [
    electionId,
    candidateListHash,
    ballotNullifier,
    ...params.electionPublicKey,
    ...params.ciphertext.c1.flat(),
    ...params.ciphertext.c2.flat(),
  ];
  assert.equal(publicStatement.length, 21);
  const poseidon = await buildPoseidon();
  const leafHashes = Array.from({ length: 4 }, (_, leafIndex) => {
    const chunk = publicStatement.slice(leafIndex * 6, leafIndex * 6 + 6);
    while (chunk.length < 6) chunk.push(0n);
    return BigInt(poseidon.F.toObject(poseidon(chunk)).toString());
  });
  const packageCommitment = BigInt(
    poseidon.F.toObject(poseidon(leafHashes)).toString(),
  );

  return {
    electionId,
    candidateListHash,
    ballotNullifier,
    packageCommitment,
    electionPublicKey: [
      params.electionPublicKey[0].toString(),
      params.electionPublicKey[1].toString(),
    ],
    c1: pointStrings(params.ciphertext.c1),
    c2: pointStrings(params.ciphertext.c2),
    selection: params.selection.map(String),
    randomness: params.randomness.map(String),
  };
}

export function flattenProofCompatibleBallotPublicSignals(
  witness: ProofCompatibleBallotWitness,
): ProofCompatibleBallotPublicSignals {
  const publicSignals = [
    witness.electionId,
    witness.candidateListHash,
    witness.ballotNullifier,
    witness.packageCommitment,
    ...witness.electionPublicKey.map(BigInt),
    ...witness.c1.flat().map(BigInt),
    ...witness.c2.flat().map(BigInt),
  ];
  assert.equal(publicSignals.length, 22);
  return publicSignals as unknown as ProofCompatibleBallotPublicSignals;
}

export function hashProofCompatibleBallotPublicSignals(
  publicSignals: ProofCompatibleBallotPublicSignals,
): Hex {
  assert.equal(publicSignals.length, 22, "ballot proof requires 22 public signals");
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters("bytes32 domain, uint256[22] publicSignals"),
      [PUBLIC_INPUT_DOMAIN, publicSignals],
    ),
  );
}
