import assert from "node:assert/strict";

import { buildBabyjub } from "circomlibjs";
import {
  decodeAbiParameters,
  encodeAbiParameters,
  isHex,
  keccak256,
  parseAbiParameters,
  stringToHex,
  type Hex,
} from "viem";

import {
  BABYJUB_SUBGROUP_ORDER,
  PROOF_COMPATIBLE_BALLOT_SCHEME,
  PROOF_COMPATIBLE_CANDIDATE_COUNT,
  SNARK_SCALAR_FIELD,
  bytes32ToSnarkField,
  computeProofCompatiblePackageCommitment,
  hashProofCompatibleBallotPublicSignals,
  hashProofCompatibleElectionPublicKey,
  type BabyJubPoint,
  type ProofCompatibleBallotCiphertext,
  type ProofCompatibleBallotPublicSignals,
} from "./proofCompatibleBallot.js";
import {
  NullifierAccumulator,
  digestContentId,
  merkleProof,
  merkleRoot,
  type Bytes32,
  type PackageInclusionReceipt,
} from "./index.js";

export const PROOF_COMPATIBLE_VOTE_PACKAGE_VERSION = 2 as const;
export const PROOF_COMPATIBLE_BATCH_MANIFEST_VERSION = 2 as const;
export const PROOF_COMPATIBLE_BALLOT_PROOF_SYSTEM =
  "groth16-ballot-validity-babyjubjub-v1" as const;

export type ProofCompatiblePointJson = readonly [x: string, y: string];
type DecimalPoint = ProofCompatiblePointJson;

export type ProofCompatibleCiphertextJson = {
  scheme: typeof PROOF_COMPATIBLE_BALLOT_SCHEME;
  electionPublicKeyHash: Bytes32;
  electionPublicKey: DecimalPoint;
  c1: readonly DecimalPoint[];
  c2: readonly DecimalPoint[];
};

export type ProofCompatibleBallotProofJson = {
  system: typeof PROOF_COMPATIBLE_BALLOT_PROOF_SYSTEM;
  proof: Hex;
  publicInputsHash: Bytes32;
};

export type ProofCompatibleVotePackageV2 = {
  version: typeof PROOF_COMPATIBLE_VOTE_PACKAGE_VERSION;
  electionId: Bytes32;
  candidateListHash: Bytes32;
  ballotNullifier: Bytes32;
  packageCommitment: Bytes32;
  ciphertext: ProofCompatibleCiphertextJson;
  ballotValidityProof: ProofCompatibleBallotProofJson;
};

export type StoredProofCompatibleVotePackageV2 = {
  contentId: string;
  package: ProofCompatibleVotePackageV2;
};

export type ProofCompatibleBatchManifestV2 = {
  version: typeof PROOF_COMPATIBLE_BATCH_MANIFEST_VERSION;
  electionId: Bytes32;
  previousNullifierRoot: Bytes32;
  nullifierRoot: Bytes32;
  cidMerkleRoot: Bytes32;
  manifestDigest: Bytes32;
  batchPublicInputsHash: Bytes32;
  batchSize: bigint;
  aggregateCiphertext: ProofCompatibleCiphertextJson;
  aggregateCiphertextDigest: Bytes32;
  packageDigests: readonly Bytes32[];
  packageLeafHashes: readonly Bytes32[];
  ballotNullifiers: readonly Bytes32[];
};

const domainHash = (domain: string): Bytes32 => keccak256(stringToHex(domain));
const normalizeBytes32 = (value: Bytes32): Bytes32 =>
  value.toLowerCase() as Bytes32;
const normalizeHex = (value: Hex): Hex => value.toLowerCase() as Hex;

function assertBytes32(value: string, label: string): asserts value is Bytes32 {
  assert.equal(
    isHex(value, { strict: true }) && value.length === 66,
    true,
    `${label} must be a bytes32 hex string`,
  );
}

function exactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  label: string,
) {
  assert.deepEqual(
    Object.keys(value).sort(),
    [...keys].sort(),
    `${label} contains unsupported or missing fields`,
  );
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

function decimalToBigInt(value: string, label: string): bigint {
  assert.match(value, /^(0|[1-9][0-9]*)$/, `${label} must be a decimal field element`);
  const result = BigInt(value);
  assert.equal(result < SNARK_SCALAR_FIELD, true, `${label} exceeds the SNARK field`);
  return result;
}

function normalizePoint(point: DecimalPoint, label: string): DecimalPoint {
  assert.equal(Array.isArray(point) && point.length === 2, true, `${label} must have x and y`);
  return [
    decimalToBigInt(point[0], `${label}.x`).toString(),
    decimalToBigInt(point[1], `${label}.y`).toString(),
  ];
}

function pointToBigInts(point: DecimalPoint): BabyJubPoint {
  return [BigInt(point[0]), BigInt(point[1])];
}

function pointToJson(point: BabyJubPoint): DecimalPoint {
  return [point[0].toString(), point[1].toString()];
}

function commitmentToBytes32(commitment: bigint): Bytes32 {
  assert.equal(commitment < SNARK_SCALAR_FIELD, true);
  return `0x${commitment.toString(16).padStart(64, "0")}`;
}

function decodeProofPublicSignals(proof: Hex): ProofCompatibleBallotPublicSignals {
  const decoded = decodeAbiParameters(
    parseAbiParameters(
      "uint256[2] pA, uint256[2][2] pB, uint256[2] pC, uint256[22] publicSignals",
    ),
    proof,
  );
  return decoded[3] as ProofCompatibleBallotPublicSignals;
}

export function proofCompatibleCiphertextToJson(params: {
  electionPublicKey: BabyJubPoint;
  ciphertext: ProofCompatibleBallotCiphertext;
}): ProofCompatibleCiphertextJson {
  return {
    scheme: PROOF_COMPATIBLE_BALLOT_SCHEME,
    electionPublicKeyHash: params.ciphertext.electionPublicKeyHash as Bytes32,
    electionPublicKey: pointToJson(params.electionPublicKey),
    c1: params.ciphertext.c1.map(pointToJson),
    c2: params.ciphertext.c2.map(pointToJson),
  };
}

export async function validateProofCompatibleVotePackage(
  input: ProofCompatibleVotePackageV2,
): Promise<ProofCompatibleVotePackageV2> {
  exactKeys(
    input as unknown as Record<string, unknown>,
    [
      "version",
      "electionId",
      "candidateListHash",
      "ballotNullifier",
      "packageCommitment",
      "ciphertext",
      "ballotValidityProof",
    ],
    "proof-compatible vote package",
  );
  assert.equal(input.version, PROOF_COMPATIBLE_VOTE_PACKAGE_VERSION);
  assertBytes32(input.electionId, "electionId");
  assertBytes32(input.candidateListHash, "candidateListHash");
  assertBytes32(input.ballotNullifier, "ballotNullifier");
  assertBytes32(input.packageCommitment, "packageCommitment");

  exactKeys(
    input.ciphertext as unknown as Record<string, unknown>,
    ["scheme", "electionPublicKeyHash", "electionPublicKey", "c1", "c2"],
    "proof-compatible ciphertext",
  );
  assert.equal(input.ciphertext.scheme, PROOF_COMPATIBLE_BALLOT_SCHEME);
  assertBytes32(input.ciphertext.electionPublicKeyHash, "electionPublicKeyHash");
  assert.equal(input.ciphertext.c1.length, PROOF_COMPATIBLE_CANDIDATE_COUNT);
  assert.equal(input.ciphertext.c2.length, PROOF_COMPATIBLE_CANDIDATE_COUNT);
  const electionPublicKey = normalizePoint(
    input.ciphertext.electionPublicKey,
    "electionPublicKey",
  );
  const c1 = input.ciphertext.c1.map((point, index) =>
    normalizePoint(point, `c1[${index}]`),
  );
  const c2 = input.ciphertext.c2.map((point, index) =>
    normalizePoint(point, `c2[${index}]`),
  );
  const publicKeyBigInts = pointToBigInts(electionPublicKey);
  assert.equal(
    normalizeBytes32(input.ciphertext.electionPublicKeyHash),
    hashProofCompatibleElectionPublicKey(publicKeyBigInts),
    "election public key hash mismatch",
  );

  exactKeys(
    input.ballotValidityProof as unknown as Record<string, unknown>,
    ["system", "proof", "publicInputsHash"],
    "proof-compatible ballot proof",
  );
  assert.equal(
    input.ballotValidityProof.system,
    PROOF_COMPATIBLE_BALLOT_PROOF_SYSTEM,
  );
  assert.equal(isHex(input.ballotValidityProof.proof, { strict: true }), true);
  assertBytes32(input.ballotValidityProof.publicInputsHash, "publicInputsHash");

  const c1BigInts = c1.map(pointToBigInts);
  const c2BigInts = c2.map(pointToBigInts);
  const expectedCommitment = await computeProofCompatiblePackageCommitment({
    electionId: bytes32ToSnarkField(input.electionId),
    candidateListHash: bytes32ToSnarkField(input.candidateListHash),
    ballotNullifier: bytes32ToSnarkField(input.ballotNullifier),
    electionPublicKey: publicKeyBigInts,
    c1: c1BigInts,
    c2: c2BigInts,
  });
  assert.equal(
    normalizeBytes32(input.packageCommitment),
    commitmentToBytes32(expectedCommitment),
    "package commitment does not match ciphertext statement",
  );

  const proofSignals = decodeProofPublicSignals(input.ballotValidityProof.proof);
  const expectedSignals = [
    bytes32ToSnarkField(input.electionId),
    bytes32ToSnarkField(input.candidateListHash),
    bytes32ToSnarkField(input.ballotNullifier),
    expectedCommitment,
    ...publicKeyBigInts,
    ...c1BigInts.flat(),
    ...c2BigInts.flat(),
  ] as unknown as ProofCompatibleBallotPublicSignals;
  assert.deepEqual(proofSignals, expectedSignals, "proof public signals do not match package");
  assert.equal(
    normalizeBytes32(input.ballotValidityProof.publicInputsHash),
    hashProofCompatibleBallotPublicSignals(expectedSignals),
    "proof public-input hash does not match package",
  );

  const babyJub = await buildBabyjub();
  for (const [label, point] of [
    ["electionPublicKey", publicKeyBigInts],
    ...c1BigInts.map((point, index) => [`c1[${index}]`, point] as const),
    ...c2BigInts.map((point, index) => [`c2[${index}]`, point] as const),
  ] as const) {
    assert.equal(
      babyJub.inSubgroup(point.map((coordinate) => babyJub.F.e(coordinate))),
      true,
      `${label} is not in the BabyJubJub subgroup`,
    );
  }

  return {
    version: PROOF_COMPATIBLE_VOTE_PACKAGE_VERSION,
    electionId: normalizeBytes32(input.electionId),
    candidateListHash: normalizeBytes32(input.candidateListHash),
    ballotNullifier: normalizeBytes32(input.ballotNullifier),
    packageCommitment: normalizeBytes32(input.packageCommitment),
    ciphertext: {
      scheme: PROOF_COMPATIBLE_BALLOT_SCHEME,
      electionPublicKeyHash: normalizeBytes32(input.ciphertext.electionPublicKeyHash),
      electionPublicKey,
      c1,
      c2,
    },
    ballotValidityProof: {
      system: PROOF_COMPATIBLE_BALLOT_PROOF_SYSTEM,
      proof: normalizeHex(input.ballotValidityProof.proof),
      publicInputsHash: normalizeBytes32(input.ballotValidityProof.publicInputsHash),
    },
  };
}

export async function serializeProofCompatibleVotePackage(
  input: ProofCompatibleVotePackageV2,
): Promise<string> {
  return `${JSON.stringify(canonicalize(await validateProofCompatibleVotePackage(input)))}\n`;
}

export async function parseProofCompatibleVotePackageJson(
  json: string,
): Promise<ProofCompatibleVotePackageV2> {
  return validateProofCompatibleVotePackage(
    JSON.parse(json) as ProofCompatibleVotePackageV2,
  );
}

export async function digestProofCompatibleVotePackage(
  input: ProofCompatibleVotePackageV2,
): Promise<Bytes32> {
  const canonical = await serializeProofCompatibleVotePackage(input);
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters("bytes32 domain, bytes canonicalPackage"),
      [domainHash("SVB_VOTE_PACKAGE_V2"), stringToHex(canonical)],
    ),
  );
}

export async function aggregateProofCompatibleCiphertexts(
  ciphertexts: readonly ProofCompatibleCiphertextJson[],
): Promise<ProofCompatibleCiphertextJson> {
  assert.equal(ciphertexts.length > 0, true, "at least one ciphertext is required");
  const keyHash = normalizeBytes32(ciphertexts[0]!.electionPublicKeyHash);
  const publicKey = ciphertexts[0]!.electionPublicKey;
  const babyJub = await buildBabyjub();
  const toFieldPoint = (point: DecimalPoint): readonly unknown[] =>
    point.map((coordinate) => babyJub.F.e(BigInt(coordinate)));
  const fromFieldPoint = (point: readonly unknown[]): DecimalPoint => [
    babyJub.F.toObject(point[0]).toString(),
    babyJub.F.toObject(point[1]).toString(),
  ];

  for (const ciphertext of ciphertexts) {
    assert.equal(ciphertext.scheme, PROOF_COMPATIBLE_BALLOT_SCHEME);
    assert.equal(normalizeBytes32(ciphertext.electionPublicKeyHash), keyHash);
    assert.deepEqual(ciphertext.electionPublicKey, publicKey);
    assert.equal(ciphertext.c1.length, PROOF_COMPATIBLE_CANDIDATE_COUNT);
    assert.equal(ciphertext.c2.length, PROOF_COMPATIBLE_CANDIDATE_COUNT);
  }

  const c1: DecimalPoint[] = [];
  const c2: DecimalPoint[] = [];
  for (let index = 0; index < PROOF_COMPATIBLE_CANDIDATE_COUNT; index += 1) {
    let first = toFieldPoint(ciphertexts[0]!.c1[index]!);
    let second = toFieldPoint(ciphertexts[0]!.c2[index]!);
    for (let ballotIndex = 1; ballotIndex < ciphertexts.length; ballotIndex += 1) {
      first = babyJub.addPoint(first, toFieldPoint(ciphertexts[ballotIndex]!.c1[index]!));
      second = babyJub.addPoint(second, toFieldPoint(ciphertexts[ballotIndex]!.c2[index]!));
    }
    c1.push(fromFieldPoint(first));
    c2.push(fromFieldPoint(second));
  }

  return {
    scheme: PROOF_COMPATIBLE_BALLOT_SCHEME,
    electionPublicKeyHash: keyHash,
    electionPublicKey: publicKey,
    c1,
    c2,
  };
}

export function digestProofCompatibleCiphertext(
  ciphertext: ProofCompatibleCiphertextJson,
): Bytes32 {
  const coordinates = [
    ...ciphertext.electionPublicKey,
    ...ciphertext.c1.flat(),
    ...ciphertext.c2.flat(),
  ].map(BigInt);
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters(
        "bytes32 domain, bytes32 scheme, bytes32 electionPublicKeyHash, uint256[] coordinates",
      ),
      [
        domainHash("SVB_BALLOT_CIPHERTEXT_V2"),
        domainHash(ciphertext.scheme),
        ciphertext.electionPublicKeyHash,
        coordinates,
      ],
    ),
  );
}

export async function decryptProofCompatibleTally(params: {
  privateKey: bigint;
  ciphertext: ProofCompatibleCiphertextJson;
  maxVotes: number;
}): Promise<readonly number[]> {
  assert.equal(params.privateKey > 0n && params.privateKey < BABYJUB_SUBGROUP_ORDER, true);
  assert.equal(Number.isInteger(params.maxVotes) && params.maxVotes >= 0, true);
  const babyJub = await buildBabyjub();
  const toFieldPoint = (point: DecimalPoint) =>
    point.map((coordinate) => babyJub.F.e(BigInt(coordinate)));
  const expectedPublicKey = babyJub.mulPointEscalar(babyJub.Base8, params.privateKey);
  const publicKey = toFieldPoint(params.ciphertext.electionPublicKey);
  assert.equal(
    babyJub.F.eq(expectedPublicKey[0], publicKey[0]) &&
      babyJub.F.eq(expectedPublicKey[1], publicKey[1]),
    true,
    "wrong election private key",
  );

  return params.ciphertext.c1.map((firstPoint, index) => {
    const first = toFieldPoint(firstPoint);
    const second = toFieldPoint(params.ciphertext.c2[index]!);
    const shared = babyJub.mulPointEscalar(first, params.privateKey);
    const message = babyJub.addPoint(second, [babyJub.F.neg(shared[0]), shared[1]]);
    for (let count = 0; count <= params.maxVotes; count += 1) {
      const candidate = babyJub.mulPointEscalar(babyJub.Base8, BigInt(count));
      if (
        babyJub.F.eq(message[0], candidate[0]) &&
        babyJub.F.eq(message[1], candidate[1])
      ) {
        return count;
      }
    }
    throw new Error(`candidate ${index} tally exceeds maxVotes or is malformed`);
  });
}

function computeProofCompatibleBatchPublicInputsHash(params: {
  electionId: Bytes32;
  previousNullifierRoot: Bytes32;
  nullifierRoot: Bytes32;
  cidMerkleRoot: Bytes32;
  manifestDigest: Bytes32;
  aggregateCiphertextDigest: Bytes32;
  packageDigests: readonly Bytes32[];
  ballotNullifiers: readonly Bytes32[];
}): Bytes32 {
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters(
        "bytes32 domain, bytes32 electionId, bytes32 previousNullifierRoot, bytes32 nullifierRoot, bytes32 cidMerkleRoot, bytes32 manifestDigest, bytes32 aggregateCiphertextDigest, bytes32[] packageDigests, bytes32[] ballotNullifiers",
      ),
      [
        domainHash("SVB_BATCH_PUBLIC_INPUTS_V2"),
        params.electionId,
        params.previousNullifierRoot,
        params.nullifierRoot,
        params.cidMerkleRoot,
        params.manifestDigest,
        params.aggregateCiphertextDigest,
        params.packageDigests,
        params.ballotNullifiers,
      ],
    ),
  );
}

export async function buildProofCompatibleBatchManifest(
  electionId: Bytes32,
  previousNullifierRoot: Bytes32,
  storedPackages: readonly StoredProofCompatibleVotePackageV2[],
  accumulator: NullifierAccumulator,
): Promise<ProofCompatibleBatchManifestV2> {
  assertBytes32(electionId, "electionId");
  assertBytes32(previousNullifierRoot, "previousNullifierRoot");
  assert.equal(storedPackages.length > 0, true, "batch cannot be empty");
  assert.equal(accumulator.root, normalizeBytes32(previousNullifierRoot));

  const validated = await Promise.all(
    storedPackages.map(async (storedPackage) => ({
      contentId: storedPackage.contentId.trim(),
      package: await validateProofCompatibleVotePackage(storedPackage.package),
      digest: await digestProofCompatibleVotePackage(storedPackage.package),
    })),
  );
  for (const storedPackage of validated) {
    assert.equal(storedPackage.package.electionId, normalizeBytes32(electionId));
  }
  validated.sort((left, right) => left.digest.localeCompare(right.digest));
  const ballotNullifiers = validated.map((entry) => entry.package.ballotNullifier);
  accumulator.addMany(ballotNullifiers);
  const packageDigests = validated.map((entry) => entry.digest);
  const packageLeafHashes = validated.map((entry) =>
    keccak256(
      encodeAbiParameters(
        parseAbiParameters(
          "bytes32 domain, bytes32 contentIdDigest, bytes32 packageDigest, bytes32 ballotNullifier, bytes32 packageCommitment",
        ),
        [
          domainHash("SVB_PACKAGE_LEAF_V2"),
          digestContentId(entry.contentId),
          entry.digest,
          entry.package.ballotNullifier,
          entry.package.packageCommitment,
        ],
      ),
    ),
  );
  const aggregateCiphertext = await aggregateProofCompatibleCiphertexts(
    validated.map((entry) => entry.package.ciphertext),
  );
  const aggregateCiphertextDigest = digestProofCompatibleCiphertext(aggregateCiphertext);
  const cidMerkleRoot = merkleRoot(packageLeafHashes);
  const nullifierRoot = accumulator.root;
  const manifestDigest = keccak256(
    encodeAbiParameters(
      parseAbiParameters(
        "bytes32 domain, uint8 version, bytes32 electionId, bytes32 previousNullifierRoot, bytes32 nullifierRoot, bytes32 cidMerkleRoot, uint64 batchSize, bytes32 aggregateCiphertextDigest, bytes32[] packageDigests, bytes32[] ballotNullifiers",
      ),
      [
        domainHash("SVB_BATCH_MANIFEST_V2"),
        PROOF_COMPATIBLE_BATCH_MANIFEST_VERSION,
        normalizeBytes32(electionId),
        normalizeBytes32(previousNullifierRoot),
        nullifierRoot,
        cidMerkleRoot,
        BigInt(validated.length),
        aggregateCiphertextDigest,
        packageDigests,
        ballotNullifiers,
      ],
    ),
  );
  const batchPublicInputsHash = computeProofCompatibleBatchPublicInputsHash({
    electionId: normalizeBytes32(electionId),
    previousNullifierRoot: normalizeBytes32(previousNullifierRoot),
    nullifierRoot,
    cidMerkleRoot,
    manifestDigest,
    aggregateCiphertextDigest,
    packageDigests,
    ballotNullifiers,
  });

  return {
    version: PROOF_COMPATIBLE_BATCH_MANIFEST_VERSION,
    electionId: normalizeBytes32(electionId),
    previousNullifierRoot: normalizeBytes32(previousNullifierRoot),
    nullifierRoot,
    cidMerkleRoot,
    manifestDigest,
    batchPublicInputsHash,
    batchSize: BigInt(validated.length),
    aggregateCiphertext,
    aggregateCiphertextDigest,
    packageDigests,
    packageLeafHashes,
    ballotNullifiers,
  };
}

export async function buildProofCompatibleInclusionReceipt(
  manifest: ProofCompatibleBatchManifestV2,
  votePackage: ProofCompatibleVotePackageV2,
): Promise<PackageInclusionReceipt> {
  const packageDigest = await digestProofCompatibleVotePackage(votePackage);
  const leafIndex = manifest.packageDigests.indexOf(packageDigest);
  assert.equal(leafIndex >= 0, true, "package digest is not in manifest");
  return {
    batchManifestDigest: manifest.manifestDigest,
    packageDigest,
    leafHash: manifest.packageLeafHashes[leafIndex]!,
    leafIndex,
    proof: merkleProof(manifest.packageLeafHashes, leafIndex),
  };
}

export function computeProofCompatibleEncryptedTallyHash(params: {
  electionId: Bytes32;
  candidateListHash: Bytes32;
  acceptedBatchManifestDigests: readonly Bytes32[];
  acceptedBatchPublicInputsHashes: readonly Bytes32[];
  aggregateCiphertext: ProofCompatibleCiphertextJson;
}): Bytes32 {
  assertBytes32(params.electionId, "electionId");
  assertBytes32(params.candidateListHash, "candidateListHash");
  assert.equal(
    params.acceptedBatchManifestDigests.length,
    params.acceptedBatchPublicInputsHashes.length,
  );
  assert.equal(params.acceptedBatchManifestDigests.length > 0, true);
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters(
        "bytes32 domain, bytes32 electionId, bytes32 candidateListHash, bytes32[] acceptedBatchManifestDigests, bytes32[] acceptedBatchPublicInputsHashes, bytes32 aggregateCiphertextDigest",
      ),
      [
        domainHash("SVB_ENCRYPTED_TALLY_PUBLIC_INPUTS_V2"),
        normalizeBytes32(params.electionId),
        normalizeBytes32(params.candidateListHash),
        params.acceptedBatchManifestDigests.map(normalizeBytes32),
        params.acceptedBatchPublicInputsHashes.map(normalizeBytes32),
        digestProofCompatibleCiphertext(params.aggregateCiphertext),
      ],
    ),
  );
}
