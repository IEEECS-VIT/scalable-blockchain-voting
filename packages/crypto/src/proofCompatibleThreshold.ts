import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

import { buildBabyjub } from "circomlibjs";
import {
  encodeAbiParameters,
  keccak256,
  parseAbiParameters,
  stringToHex,
  type Hex,
} from "viem";

import {
  BABYJUB_SUBGROUP_ORDER,
  PROOF_COMPATIBLE_CANDIDATE_COUNT,
  hashProofCompatibleElectionPublicKey,
  type BabyJubPoint,
} from "./proofCompatibleBallot.js";
import {
  type ProofCompatibleCiphertextJson,
  type ProofCompatiblePointJson,
} from "./proofCompatiblePipeline.js";

export const PROOF_COMPATIBLE_THRESHOLD_SHARE_SCHEME =
  "threshold-babyjubjub-elgamal-share-v1" as const;

export type ProofCompatibleThresholdKeyShare = {
  trusteeIndex: number;
  privateShare: string;
  publicShare: ProofCompatiblePointJson;
};

export type ProofCompatibleThresholdKeySet = {
  threshold: number;
  trusteeCount: number;
  publicKey: ProofCompatiblePointJson;
  publicKeyHash: Hex;
  shares: readonly ProofCompatibleThresholdKeyShare[];
};

export type ProofCompatibleDleqProof = {
  commitmentToGenerator: ProofCompatiblePointJson;
  commitmentToCiphertext: ProofCompatiblePointJson;
  response: string;
};

export type ProofCompatibleDecryptionShare = {
  scheme: typeof PROOF_COMPATIBLE_THRESHOLD_SHARE_SCHEME;
  trusteeIndex: number;
  trusteePublicShare: ProofCompatiblePointJson;
  electionPublicKeyHash: Hex;
  decryptionSharePoints: readonly ProofCompatiblePointJson[];
  proofs: readonly ProofCompatibleDleqProof[];
};

const domainHash = (domain: string) => keccak256(stringToHex(domain));

function mod(value: bigint): bigint {
  const result = value % BABYJUB_SUBGROUP_ORDER;
  return result >= 0n ? result : result + BABYJUB_SUBGROUP_ORDER;
}

function modInverse(value: bigint): bigint {
  let low = mod(value);
  let high = BABYJUB_SUBGROUP_ORDER;
  let lowCoefficient = 1n;
  let highCoefficient = 0n;
  while (low > 1n) {
    const ratio = high / low;
    [high, low] = [low, high - low * ratio];
    [highCoefficient, lowCoefficient] = [
      lowCoefficient,
      highCoefficient - lowCoefficient * ratio,
    ];
  }
  assert.equal(low, 1n, "value has no subgroup inverse");
  return mod(lowCoefficient);
}

function randomScalar(): bigint {
  return (
    BigInt(`0x${randomBytes(32).toString("hex")}`) %
      (BABYJUB_SUBGROUP_ORDER - 1n)
  ) + 1n;
}

function assertScalar(value: bigint, label: string): bigint {
  assert.equal(value > 0n && value < BABYJUB_SUBGROUP_ORDER, true, `${label} is invalid`);
  return value;
}

function pointToBigInts(point: ProofCompatiblePointJson): BabyJubPoint {
  return [BigInt(point[0]), BigInt(point[1])];
}

function fieldPointToJson(
  field: { toObject(value: unknown): { toString(): string } },
  point: readonly unknown[],
): ProofCompatiblePointJson {
  return [
    field.toObject(point[0]).toString(),
    field.toObject(point[1]).toString(),
  ];
}

function lagrangeCoefficientAtZero(index: bigint, indexes: readonly bigint[]): bigint {
  let numerator = 1n;
  let denominator = 1n;
  for (const other of indexes) {
    if (other === index) continue;
    numerator = mod(numerator * -other);
    denominator = mod(denominator * (index - other));
  }
  return mod(numerator * modInverse(denominator));
}

function challenge(params: {
  electionPublicKeyHash: Hex;
  trusteeIndex: number;
  trusteePublicShare: ProofCompatiblePointJson;
  ciphertextPoint: ProofCompatiblePointJson;
  decryptionSharePoint: ProofCompatiblePointJson;
  commitmentToGenerator: ProofCompatiblePointJson;
  commitmentToCiphertext: ProofCompatiblePointJson;
}): bigint {
  const coordinates = [
    ...params.trusteePublicShare,
    ...params.ciphertextPoint,
    ...params.decryptionSharePoint,
    ...params.commitmentToGenerator,
    ...params.commitmentToCiphertext,
  ].map(BigInt);
  return mod(BigInt(keccak256(
    encodeAbiParameters(
      parseAbiParameters(
        "bytes32 domain, bytes32 electionPublicKeyHash, uint32 trusteeIndex, uint256[] coordinates",
      ),
      [
        domainHash("SVB_BABYJUB_DLEQ_SHARE_V1"),
        params.electionPublicKeyHash,
        params.trusteeIndex,
        coordinates,
      ],
    ),
  )));
}

export async function createProofCompatibleThresholdKeySet(params: {
  threshold: number;
  trusteeCount: number;
  privateKey?: bigint;
  coefficients?: readonly bigint[];
}): Promise<ProofCompatibleThresholdKeySet> {
  assert.equal(Number.isInteger(params.threshold) && params.threshold >= 2, true);
  assert.equal(
    Number.isInteger(params.trusteeCount) && params.trusteeCount >= params.threshold,
    true,
  );
  const secret = assertScalar(params.privateKey ?? randomScalar(), "privateKey");
  if (params.coefficients !== undefined) {
    assert.equal(params.coefficients.length, params.threshold - 1);
  }
  const coefficients = params.coefficients === undefined
    ? Array.from({ length: params.threshold - 1 }, randomScalar)
    : params.coefficients.map((coefficient, index) =>
        assertScalar(coefficient, `coefficients[${index}]`),
      );
  const babyJub = await buildBabyjub();
  const publicKeyPoint = babyJub.mulPointEscalar(babyJub.Base8, secret);
  const publicKey = fieldPointToJson(babyJub.F, publicKeyPoint);
  const shares: ProofCompatibleThresholdKeyShare[] = [];
  for (let trusteeIndex = 1; trusteeIndex <= params.trusteeCount; trusteeIndex += 1) {
    const x = BigInt(trusteeIndex);
    let privateShare = secret;
    let power = x;
    for (const coefficient of coefficients) {
      privateShare = mod(privateShare + coefficient * power);
      power = mod(power * x);
    }
    assertScalar(privateShare, `share[${trusteeIndex}]`);
    shares.push({
      trusteeIndex,
      privateShare: privateShare.toString(),
      publicShare: fieldPointToJson(
        babyJub.F,
        babyJub.mulPointEscalar(babyJub.Base8, privateShare),
      ),
    });
  }
  return {
    threshold: params.threshold,
    trusteeCount: params.trusteeCount,
    publicKey,
    publicKeyHash: hashProofCompatibleElectionPublicKey(pointToBigInts(publicKey)),
    shares,
  };
}

export async function createProofCompatibleDecryptionShare(params: {
  trusteeIndex: number;
  privateShare: string;
  ciphertext: ProofCompatibleCiphertextJson;
  proofNonces?: readonly bigint[];
}): Promise<ProofCompatibleDecryptionShare> {
  const privateShare = assertScalar(BigInt(params.privateShare), "privateShare");
  if (params.proofNonces !== undefined) {
    assert.equal(params.proofNonces.length, PROOF_COMPATIBLE_CANDIDATE_COUNT);
  }
  const babyJub = await buildBabyjub();
  const publicSharePoint = babyJub.mulPointEscalar(babyJub.Base8, privateShare);
  const trusteePublicShare = fieldPointToJson(babyJub.F, publicSharePoint);
  const decryptionSharePoints: ProofCompatiblePointJson[] = [];
  const proofs: ProofCompatibleDleqProof[] = [];
  for (let index = 0; index < PROOF_COMPATIBLE_CANDIDATE_COUNT; index += 1) {
    const ciphertextPoint = params.ciphertext.c1[index]!;
    const ciphertextFieldPoint = pointToBigInts(ciphertextPoint).map((coordinate) =>
      babyJub.F.e(coordinate),
    );
    const decryptionShareFieldPoint = babyJub.mulPointEscalar(
      ciphertextFieldPoint,
      privateShare,
    );
    const decryptionSharePoint = fieldPointToJson(
      babyJub.F,
      decryptionShareFieldPoint,
    );
    const nonce = assertScalar(params.proofNonces?.[index] ?? randomScalar(), `nonce[${index}]`);
    const commitmentToGenerator = fieldPointToJson(
      babyJub.F,
      babyJub.mulPointEscalar(babyJub.Base8, nonce),
    );
    const commitmentToCiphertext = fieldPointToJson(
      babyJub.F,
      babyJub.mulPointEscalar(ciphertextFieldPoint, nonce),
    );
    const proofChallenge = challenge({
      electionPublicKeyHash: params.ciphertext.electionPublicKeyHash,
      trusteeIndex: params.trusteeIndex,
      trusteePublicShare,
      ciphertextPoint,
      decryptionSharePoint,
      commitmentToGenerator,
      commitmentToCiphertext,
    });
    decryptionSharePoints.push(decryptionSharePoint);
    proofs.push({
      commitmentToGenerator,
      commitmentToCiphertext,
      response: mod(nonce + proofChallenge * privateShare).toString(),
    });
  }
  return {
    scheme: PROOF_COMPATIBLE_THRESHOLD_SHARE_SCHEME,
    trusteeIndex: params.trusteeIndex,
    trusteePublicShare,
    electionPublicKeyHash: params.ciphertext.electionPublicKeyHash,
    decryptionSharePoints,
    proofs,
  };
}

export async function verifyProofCompatibleDecryptionShare(params: {
  ciphertext: ProofCompatibleCiphertextJson;
  share: ProofCompatibleDecryptionShare;
}): Promise<boolean> {
  try {
    assert.equal(params.share.scheme, PROOF_COMPATIBLE_THRESHOLD_SHARE_SCHEME);
    assert.equal(params.share.electionPublicKeyHash, params.ciphertext.electionPublicKeyHash);
    assert.equal(params.share.decryptionSharePoints.length, PROOF_COMPATIBLE_CANDIDATE_COUNT);
    assert.equal(params.share.proofs.length, PROOF_COMPATIBLE_CANDIDATE_COUNT);
    const babyJub = await buildBabyjub();
    const toFieldPoint = (point: ProofCompatiblePointJson) =>
      pointToBigInts(point).map((coordinate) => babyJub.F.e(coordinate));
    const pointEquals = (left: readonly unknown[], right: readonly unknown[]) =>
      babyJub.F.eq(left[0], right[0]) && babyJub.F.eq(left[1], right[1]);
    const trusteePublicShare = toFieldPoint(params.share.trusteePublicShare);
    for (let index = 0; index < PROOF_COMPATIBLE_CANDIDATE_COUNT; index += 1) {
      const ciphertextPoint = params.ciphertext.c1[index]!;
      const decryptionSharePoint = params.share.decryptionSharePoints[index]!;
      const proof = params.share.proofs[index]!;
      const proofChallenge = challenge({
        electionPublicKeyHash: params.share.electionPublicKeyHash,
        trusteeIndex: params.share.trusteeIndex,
        trusteePublicShare: params.share.trusteePublicShare,
        ciphertextPoint,
        decryptionSharePoint,
        commitmentToGenerator: proof.commitmentToGenerator,
        commitmentToCiphertext: proof.commitmentToCiphertext,
      });
      const response = assertScalar(BigInt(proof.response), `response[${index}]`);
      const leftGenerator = babyJub.mulPointEscalar(babyJub.Base8, response);
      const rightGenerator = babyJub.addPoint(
        toFieldPoint(proof.commitmentToGenerator),
        babyJub.mulPointEscalar(trusteePublicShare, proofChallenge),
      );
      const ciphertextFieldPoint = toFieldPoint(ciphertextPoint);
      const leftCiphertext = babyJub.mulPointEscalar(ciphertextFieldPoint, response);
      const rightCiphertext = babyJub.addPoint(
        toFieldPoint(proof.commitmentToCiphertext),
        babyJub.mulPointEscalar(toFieldPoint(decryptionSharePoint), proofChallenge),
      );
      if (!pointEquals(leftGenerator, rightGenerator)) {
        throw new Error(`generator DLEQ equation failed at candidate ${index}`);
      }
      if (!pointEquals(leftCiphertext, rightCiphertext)) {
        throw new Error(`ciphertext DLEQ equation failed at candidate ${index}`);
      }
    }
    return true;
  } catch (error) {
    if (process.env.DEBUG_DLEQ === "1") console.error(error);
    return false;
  }
}

export async function decryptProofCompatibleTallyWithShares(params: {
  ciphertext: ProofCompatibleCiphertextJson;
  shares: readonly ProofCompatibleDecryptionShare[];
  threshold: number;
  maxVotes: number;
}): Promise<readonly number[]> {
  assert.equal(params.shares.length >= params.threshold, true, "insufficient shares");
  const selectedShares = params.shares.slice(0, params.threshold);
  assert.equal(new Set(selectedShares.map((share) => share.trusteeIndex)).size, selectedShares.length);
  for (const share of selectedShares) {
    assert.equal(
      await verifyProofCompatibleDecryptionShare({ ciphertext: params.ciphertext, share }),
      true,
      `invalid share proof from trustee ${share.trusteeIndex}`,
    );
  }
  const babyJub = await buildBabyjub();
  const toFieldPoint = (point: ProofCompatiblePointJson) =>
    pointToBigInts(point).map((coordinate) => babyJub.F.e(coordinate));
  const indexes = selectedShares.map((share) => BigInt(share.trusteeIndex));
  const counts: number[] = [];
  for (let candidateIndex = 0; candidateIndex < PROOF_COMPATIBLE_CANDIDATE_COUNT; candidateIndex += 1) {
    let combined: readonly unknown[] = [babyJub.F.e(0n), babyJub.F.e(1n)];
    for (const share of selectedShares) {
      const coefficient = lagrangeCoefficientAtZero(
        BigInt(share.trusteeIndex),
        indexes,
      );
      combined = babyJub.addPoint(
        combined,
        babyJub.mulPointEscalar(
          toFieldPoint(share.decryptionSharePoints[candidateIndex]!),
          coefficient,
        ),
      );
    }
    const second = toFieldPoint(params.ciphertext.c2[candidateIndex]!);
    const message = babyJub.addPoint(second, [babyJub.F.neg(combined[0]), combined[1]]);
    let count: number | undefined;
    for (let candidateCount = 0; candidateCount <= params.maxVotes; candidateCount += 1) {
      const expected = babyJub.mulPointEscalar(babyJub.Base8, BigInt(candidateCount));
      if (babyJub.F.eq(message[0], expected[0]) && babyJub.F.eq(message[1], expected[1])) {
        count = candidateCount;
        break;
      }
    }
    assert.notEqual(count, undefined, `candidate ${candidateIndex} count is out of range`);
    counts.push(count!);
  }
  return counts;
}

export function digestProofCompatibleDecryptionShare(
  share: ProofCompatibleDecryptionShare,
): Hex {
  const coordinates = [
    ...share.trusteePublicShare,
    ...share.decryptionSharePoints.flat(),
    ...share.proofs.flatMap((proof) => [
      ...proof.commitmentToGenerator,
      ...proof.commitmentToCiphertext,
      proof.response,
    ]),
  ].map(BigInt);
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters(
        "bytes32 domain, uint32 trusteeIndex, bytes32 electionPublicKeyHash, uint256[] coordinates",
      ),
      [
        domainHash("SVB_BABYJUB_DECRYPTION_SHARE_DIGEST_V1"),
        share.trusteeIndex,
        share.electionPublicKeyHash,
        coordinates,
      ],
    ),
  );
}
