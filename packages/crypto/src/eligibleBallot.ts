import assert from "node:assert/strict";

import { buildPoseidon } from "circomlibjs";
import {
  encodeAbiParameters,
  keccak256,
  parseAbiParameters,
  stringToHex,
  type Hex,
} from "viem";

import {
  PROOF_COMPATIBLE_CANDIDATE_COUNT,
  bytes32ToSnarkField,
  encryptProofCompatibleBallot,
  type BabyJubPoint,
  type ProofCompatibleBallotCiphertext,
} from "./proofCompatibleBallot.js";

export const ELIGIBILITY_TREE_DEPTH = 24 as const;
export const ELIGIBLE_BALLOT_VERSION = 3 as const;
export const ELIGIBLE_BALLOT_NULLIFIER_DOMAIN = 2026071301n;
export const ELIGIBLE_BALLOT_PROOF_SYSTEM =
  "groth16-eligible-ballot-babyjubjub-v1" as const;

const ELIGIBLE_PUBLIC_INPUT_DOMAIN = keccak256(
  stringToHex("SVB_ELIGIBLE_BALLOT_PUBLIC_INPUTS_V1"),
);

type Poseidon = Awaited<ReturnType<typeof buildPoseidon>>;

export type EligibilityCredential = {
  secret: bigint;
  nonce: bigint;
  index: number;
};

export type EligibilityMembership = {
  credentialCommitment: bigint;
  eligibilityRoot: bigint;
  pathElements: readonly bigint[];
  pathIndices: readonly number[];
};

export type EligibleBallotWitness = {
  electionId: string;
  candidateListHash: string;
  eligibilityRoot: string;
  ballotNullifier: string;
  packageCommitment: string;
  electionPublicKey: readonly [string, string];
  c1: readonly (readonly [string, string])[];
  c2: readonly (readonly [string, string])[];
  credentialSecret: string;
  credentialNonce: string;
  eligibilityPathElements: readonly string[];
  eligibilityPathIndices: readonly string[];
  selection: readonly string[];
  randomness: readonly string[];
};

export type EligibleBallotPublicSignals = readonly [
  bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint,
  bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint,
  bigint, bigint, bigint, bigint, bigint, bigint, bigint,
];

function poseidonValue(poseidon: Poseidon, inputs: readonly bigint[]): bigint {
  return BigInt(poseidon.F.toObject(poseidon(inputs)).toString());
}

export async function computeEligibilityCredentialCommitment(params: {
  secret: bigint;
  nonce: bigint;
}): Promise<bigint> {
  assert.notEqual(params.secret, 0n, "credential secret must be nonzero");
  const poseidon = await buildPoseidon();
  return poseidonValue(poseidon, [params.secret, params.nonce]);
}

export async function buildEligibilityMembership(params: {
  credentials: readonly EligibilityCredential[];
  targetIndex: number;
  depth?: number;
}): Promise<EligibilityMembership> {
  const depth = params.depth ?? ELIGIBILITY_TREE_DEPTH;
  assert.equal(Number.isInteger(depth) && depth > 0 && depth <= 30, true);
  assert.equal(params.targetIndex >= 0 && params.targetIndex < 2 ** depth, true);
  const credential = params.credentials.find(
    (candidate) => candidate.index === params.targetIndex,
  );
  assert.ok(credential, "target credential is not in the eligibility set");
  assert.equal(
    new Set(params.credentials.map((candidate) => candidate.index)).size,
    params.credentials.length,
    "eligibility credential indices must be unique",
  );

  const poseidon = await buildPoseidon();
  const zeroHashes: bigint[] = [0n];
  for (let level = 0; level < depth; level += 1) {
    zeroHashes.push(
      poseidonValue(poseidon, [zeroHashes[level]!, zeroHashes[level]!]),
    );
  }

  const levelMaps: Map<number, bigint>[] = [];
  let current = new Map<number, bigint>();
  for (const candidate of params.credentials) {
    assert.equal(candidate.index >= 0 && candidate.index < 2 ** depth, true);
    current.set(
      candidate.index,
      poseidonValue(poseidon, [candidate.secret, candidate.nonce]),
    );
  }
  levelMaps.push(current);
  for (let level = 0; level < depth; level += 1) {
    const parents = new Map<number, bigint>();
    const parentIndices = new Set(
      [...current.keys()].map((index) => Math.floor(index / 2)),
    );
    for (const parentIndex of parentIndices) {
      const left = current.get(parentIndex * 2) ?? zeroHashes[level]!;
      const right = current.get(parentIndex * 2 + 1) ?? zeroHashes[level]!;
      parents.set(parentIndex, poseidonValue(poseidon, [left, right]));
    }
    current = parents;
    levelMaps.push(current);
  }

  const pathElements: bigint[] = [];
  const pathIndices: number[] = [];
  let index = params.targetIndex;
  for (let level = 0; level < depth; level += 1) {
    pathIndices.push(index & 1);
    pathElements.push(
      levelMaps[level]!.get(index ^ 1) ?? zeroHashes[level]!,
    );
    index = Math.floor(index / 2);
  }

  return {
    credentialCommitment: levelMaps[0]!.get(params.targetIndex)!,
    eligibilityRoot: levelMaps[depth]!.get(0) ?? zeroHashes[depth]!,
    pathElements,
    pathIndices,
  };
}

export async function computeEligibleBallotNullifier(params: {
  electionId: Hex;
  credentialSecret: bigint;
}): Promise<bigint> {
  assert.notEqual(params.credentialSecret, 0n);
  const poseidon = await buildPoseidon();
  return poseidonValue(poseidon, [
    ELIGIBLE_BALLOT_NULLIFIER_DOMAIN,
    bytes32ToSnarkField(params.electionId),
    params.credentialSecret,
  ]);
}

export async function computeEligiblePackageCommitment(params: {
  electionId: bigint;
  candidateListHash: bigint;
  eligibilityRoot: bigint;
  ballotNullifier: bigint;
  electionPublicKey: BabyJubPoint;
  c1: readonly BabyJubPoint[];
  c2: readonly BabyJubPoint[];
}): Promise<bigint> {
  assert.equal(params.c1.length, PROOF_COMPATIBLE_CANDIDATE_COUNT);
  assert.equal(params.c2.length, PROOF_COMPATIBLE_CANDIDATE_COUNT);
  const statement = [
    params.electionId,
    params.candidateListHash,
    params.eligibilityRoot,
    params.ballotNullifier,
    ...params.electionPublicKey,
    ...params.c1.flat(),
    ...params.c2.flat(),
  ];
  assert.equal(statement.length, 22);
  const poseidon = await buildPoseidon();
  const leaves = Array.from({ length: 4 }, (_, leafIndex) => {
    const chunk = statement.slice(leafIndex * 6, leafIndex * 6 + 6);
    while (chunk.length < 6) chunk.push(0n);
    return poseidonValue(poseidon, chunk);
  });
  return poseidonValue(poseidon, leaves);
}

export async function buildEligibleBallotWitness(params: {
  electionId: Hex;
  candidateListHash: Hex;
  electionPublicKey: BabyJubPoint;
  credential: EligibilityCredential;
  membership: EligibilityMembership;
  selectedIndex: number;
  randomness?: readonly bigint[];
}): Promise<{
  witness: EligibleBallotWitness;
  ciphertext: ProofCompatibleBallotCiphertext;
}> {
  assert.equal(params.membership.pathElements.length, ELIGIBILITY_TREE_DEPTH);
  assert.equal(params.membership.pathIndices.length, ELIGIBILITY_TREE_DEPTH);
  const encrypted = await encryptProofCompatibleBallot({
    electionPublicKey: params.electionPublicKey,
    selectedIndex: params.selectedIndex,
    randomness: params.randomness,
  });
  const electionId = bytes32ToSnarkField(params.electionId);
  const candidateListHash = bytes32ToSnarkField(params.candidateListHash);
  const ballotNullifier = await computeEligibleBallotNullifier({
    electionId: params.electionId,
    credentialSecret: params.credential.secret,
  });
  const packageCommitment = await computeEligiblePackageCommitment({
    electionId,
    candidateListHash,
    eligibilityRoot: params.membership.eligibilityRoot,
    ballotNullifier,
    electionPublicKey: params.electionPublicKey,
    c1: encrypted.ciphertext.c1,
    c2: encrypted.ciphertext.c2,
  });
  const pointStrings = (points: readonly BabyJubPoint[]) =>
    points.map((point) => [point[0].toString(), point[1].toString()] as const);
  return {
    ciphertext: encrypted.ciphertext,
    witness: {
      electionId: electionId.toString(),
      candidateListHash: candidateListHash.toString(),
      eligibilityRoot: params.membership.eligibilityRoot.toString(),
      ballotNullifier: ballotNullifier.toString(),
      packageCommitment: packageCommitment.toString(),
      electionPublicKey: params.electionPublicKey.map(String) as [string, string],
      c1: pointStrings(encrypted.ciphertext.c1),
      c2: pointStrings(encrypted.ciphertext.c2),
      credentialSecret: params.credential.secret.toString(),
      credentialNonce: params.credential.nonce.toString(),
      eligibilityPathElements: params.membership.pathElements.map(String),
      eligibilityPathIndices: params.membership.pathIndices.map(String),
      selection: encrypted.selection.map(String),
      randomness: encrypted.randomness.map(String),
    },
  };
}

export function flattenEligibleBallotPublicSignals(
  witness: EligibleBallotWitness,
): EligibleBallotPublicSignals {
  const signals = [
    witness.electionId,
    witness.candidateListHash,
    witness.eligibilityRoot,
    witness.ballotNullifier,
    witness.packageCommitment,
    ...witness.electionPublicKey,
    ...witness.c1.flat(),
    ...witness.c2.flat(),
  ].map(BigInt);
  assert.equal(signals.length, 23);
  return signals as unknown as EligibleBallotPublicSignals;
}

export function hashEligibleBallotPublicSignals(
  publicSignals: EligibleBallotPublicSignals,
): Hex {
  return keccak256(encodeAbiParameters(
    parseAbiParameters("bytes32 domain, uint256[23] publicSignals"),
    [ELIGIBLE_PUBLIC_INPUT_DOMAIN, publicSignals],
  ));
}
