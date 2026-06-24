import assert from "node:assert/strict";

import {
  encodeAbiParameters,
  isHex,
  keccak256,
  parseAbiParameters,
  stringToHex,
  zeroHash,
} from "viem";

export type Hex = `0x${string}`;
export type Bytes32 = Hex;

export const VOTE_PACKAGE_VERSION = 1 as const;
export const BATCH_MANIFEST_VERSION = 1 as const;

export const BALLOT_CIPHERTEXT_SCHEME =
  "ec-elgamal-ciphertext-points-v1" as const;
export const BALLOT_PROOF_SYSTEM = "groth16-ballot-validity-v1" as const;

export type BallotCiphertextV1 = {
  scheme: typeof BALLOT_CIPHERTEXT_SCHEME;
  electionPublicKeyHash: Bytes32;
  points: readonly Hex[];
};

export type BallotValidityProofV1 = {
  system: typeof BALLOT_PROOF_SYSTEM;
  proof: Hex;
  publicInputsHash: Bytes32;
};

export type VotePackageV1 = {
  version: typeof VOTE_PACKAGE_VERSION;
  electionId: Bytes32;
  candidateListHash: Bytes32;
  ballotNullifier: Bytes32;
  ciphertext: BallotCiphertextV1;
  ballotValidityProof: BallotValidityProofV1;
};

export type StoredVotePackageV1 = {
  contentId: string;
  package: VotePackageV1;
};

export type BatchManifestV1 = {
  version: typeof BATCH_MANIFEST_VERSION;
  electionId: Bytes32;
  previousNullifierRoot: Bytes32;
  nullifierRoot: Bytes32;
  cidMerkleRoot: Bytes32;
  manifestDigest: Bytes32;
  batchSize: bigint;
  packageDigests: readonly Bytes32[];
  packageLeafHashes: readonly Bytes32[];
  ballotNullifiers: readonly Bytes32[];
};

type MerkleProofStep = {
  sibling: Bytes32;
  direction: "left" | "right";
};

export type PackageInclusionReceipt = {
  batchManifestDigest: Bytes32;
  packageDigest: Bytes32;
  leafHash: Bytes32;
  leafIndex: number;
  proof: readonly MerkleProofStep[];
};

const exactKeys = <T extends Record<string, unknown>>(
  value: T,
  keys: readonly string[],
  label: string,
) => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  assert.deepEqual(
    actual,
    expected,
    `${label} must contain exactly: ${expected.join(", ")}`,
  );
};

function assertBytes32(value: string, label: string): asserts value is Bytes32 {
  assert.equal(
    isHex(value, { strict: true }) && value.length === 66,
    true,
    `${label} must be a 32-byte hex string`,
  );
}

function assertHexBytes(value: string, label: string): asserts value is Hex {
  assert.equal(
    isHex(value, { strict: true }) && value.length >= 4,
    true,
    `${label} must be non-empty hex bytes`,
  );
}

const domainHash = (domain: string): Bytes32 => keccak256(stringToHex(domain));

const normalizeBytes32 = (value: Bytes32): Bytes32 =>
  value.toLowerCase() as Bytes32;

const normalizeHex = (value: Hex): Hex => value.toLowerCase() as Hex;

export function validateVotePackage(input: VotePackageV1): VotePackageV1 {
  exactKeys(
    input as unknown as Record<string, unknown>,
    [
      "version",
      "electionId",
      "candidateListHash",
      "ballotNullifier",
      "ciphertext",
      "ballotValidityProof",
    ],
    "vote package",
  );
  assert.equal(input.version, VOTE_PACKAGE_VERSION, "unsupported vote package version");
  assertBytes32(input.electionId, "electionId");
  assertBytes32(input.candidateListHash, "candidateListHash");
  assertBytes32(input.ballotNullifier, "ballotNullifier");

  exactKeys(
    input.ciphertext as unknown as Record<string, unknown>,
    ["scheme", "electionPublicKeyHash", "points"],
    "ciphertext",
  );
  assert.equal(
    input.ciphertext.scheme,
    BALLOT_CIPHERTEXT_SCHEME,
    "unsupported ciphertext scheme",
  );
  assertBytes32(input.ciphertext.electionPublicKeyHash, "electionPublicKeyHash");
  assert.equal(
    Array.isArray(input.ciphertext.points) && input.ciphertext.points.length > 0,
    true,
    "ciphertext.points must contain at least one point",
  );
  for (const [index, point] of input.ciphertext.points.entries()) {
    assertHexBytes(point, `ciphertext.points[${index}]`);
  }

  exactKeys(
    input.ballotValidityProof as unknown as Record<string, unknown>,
    ["system", "proof", "publicInputsHash"],
    "ballot validity proof",
  );
  assert.equal(
    input.ballotValidityProof.system,
    BALLOT_PROOF_SYSTEM,
    "unsupported ballot proof system",
  );
  assertHexBytes(input.ballotValidityProof.proof, "ballotValidityProof.proof");
  assertBytes32(input.ballotValidityProof.publicInputsHash, "publicInputsHash");

  return {
    version: VOTE_PACKAGE_VERSION,
    electionId: normalizeBytes32(input.electionId),
    candidateListHash: normalizeBytes32(input.candidateListHash),
    ballotNullifier: normalizeBytes32(input.ballotNullifier),
    ciphertext: {
      scheme: BALLOT_CIPHERTEXT_SCHEME,
      electionPublicKeyHash: normalizeBytes32(input.ciphertext.electionPublicKeyHash),
      points: input.ciphertext.points.map(normalizeHex),
    },
    ballotValidityProof: {
      system: BALLOT_PROOF_SYSTEM,
      proof: normalizeHex(input.ballotValidityProof.proof),
      publicInputsHash: normalizeBytes32(input.ballotValidityProof.publicInputsHash),
    },
  };
}

export function digestVotePackage(input: VotePackageV1): Bytes32 {
  const votePackage = validateVotePackage(input);

  return keccak256(
    encodeAbiParameters(
      parseAbiParameters(
        "bytes32 domain, uint8 version, bytes32 electionId, bytes32 candidateListHash, bytes32 ballotNullifier, bytes32 ciphertextScheme, bytes32 electionPublicKeyHash, bytes[] ciphertextPoints, bytes32 proofSystem, bytes proof, bytes32 publicInputsHash",
      ),
      [
        domainHash("SVB_VOTE_PACKAGE_V1"),
        votePackage.version,
        votePackage.electionId,
        votePackage.candidateListHash,
        votePackage.ballotNullifier,
        domainHash(votePackage.ciphertext.scheme),
        votePackage.ciphertext.electionPublicKeyHash,
        [...votePackage.ciphertext.points],
        domainHash(votePackage.ballotValidityProof.system),
        votePackage.ballotValidityProof.proof,
        votePackage.ballotValidityProof.publicInputsHash,
      ],
    ),
  );
}

export function digestContentId(contentId: string): Bytes32 {
  assert.equal(contentId.trim().length > 0, true, "contentId cannot be empty");
  return keccak256(stringToHex(contentId.trim()));
}

export function hashPackageLeaf(storedPackage: StoredVotePackageV1): Bytes32 {
  const normalizedPackage = validateVotePackage(storedPackage.package);
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters(
        "bytes32 domain, bytes32 contentIdDigest, bytes32 packageDigest, bytes32 ballotNullifier",
      ),
      [
        domainHash("SVB_PACKAGE_LEAF_V1"),
        digestContentId(storedPackage.contentId),
        digestVotePackage(normalizedPackage),
        normalizedPackage.ballotNullifier,
      ],
    ),
  );
}

export function hashMerklePair(left: Bytes32, right: Bytes32): Bytes32 {
  assertBytes32(left, "left");
  assertBytes32(right, "right");
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters("bytes32 domain, bytes32 left, bytes32 right"),
      [domainHash("SVB_MERKLE_PAIR_V1"), normalizeBytes32(left), normalizeBytes32(right)],
    ),
  );
}

export function merkleRoot(leaves: readonly Bytes32[]): Bytes32 {
  if (leaves.length === 0) return zeroHash;

  let level = leaves.map((leaf, index) => {
    assertBytes32(leaf, `leaf[${index}]`);
    return normalizeBytes32(leaf);
  });

  while (level.length > 1) {
    const nextLevel: Bytes32[] = [];
    for (let index = 0; index < level.length; index += 2) {
      const left = level[index]!;
      const right = level[index + 1] ?? left;
      nextLevel.push(hashMerklePair(left, right));
    }
    level = nextLevel;
  }

  return level[0]!;
}

export function merkleProof(
  leaves: readonly Bytes32[],
  leafIndex: number,
): readonly MerkleProofStep[] {
  assert.equal(Number.isInteger(leafIndex), true, "leafIndex must be an integer");
  assert.equal(leafIndex >= 0 && leafIndex < leaves.length, true, "leafIndex out of range");

  let index = leafIndex;
  let level = leaves.map(normalizeBytes32);
  const proof: MerkleProofStep[] = [];

  while (level.length > 1) {
    const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
    const sibling = level[siblingIndex] ?? level[index]!;
    proof.push({
      sibling,
      direction: index % 2 === 0 ? "right" : "left",
    });

    const nextLevel: Bytes32[] = [];
    for (let cursor = 0; cursor < level.length; cursor += 2) {
      const left = level[cursor]!;
      const right = level[cursor + 1] ?? left;
      nextLevel.push(hashMerklePair(left, right));
    }
    index = Math.floor(index / 2);
    level = nextLevel;
  }

  return proof;
}

export function verifyMerkleProof(
  leafHash: Bytes32,
  proof: readonly MerkleProofStep[],
  expectedRoot: Bytes32,
): boolean {
  let cursor = normalizeBytes32(leafHash);
  for (const step of proof) {
    assertBytes32(step.sibling, "proof sibling");
    cursor =
      step.direction === "left"
        ? hashMerklePair(step.sibling, cursor)
        : hashMerklePair(cursor, step.sibling);
  }
  return cursor === normalizeBytes32(expectedRoot);
}

export function nullifierSetRoot(nullifiers: readonly Bytes32[]): Bytes32 {
  const uniqueSorted = [...new Set(nullifiers.map(normalizeBytes32))].sort();
  return merkleRoot(
    uniqueSorted.map((nullifier) =>
      keccak256(
        encodeAbiParameters(
          parseAbiParameters("bytes32 domain, bytes32 ballotNullifier"),
          [domainHash("SVB_NULLIFIER_LEAF_V1"), nullifier],
        ),
      ),
    ),
  );
}

export class NullifierAccumulator {
  readonly #seen = new Set<Bytes32>();

  constructor(initialNullifiers: readonly Bytes32[] = []) {
    for (const nullifier of initialNullifiers) {
      this.add(nullifier);
    }
  }

  get root(): Bytes32 {
    return nullifierSetRoot([...this.#seen]);
  }

  has(nullifier: Bytes32): boolean {
    return this.#seen.has(normalizeBytes32(nullifier));
  }

  add(nullifier: Bytes32): void {
    assertBytes32(nullifier, "ballotNullifier");
    const normalized = normalizeBytes32(nullifier);
    assert.equal(this.#seen.has(normalized), false, "duplicate ballot nullifier");
    this.#seen.add(normalized);
  }

  addMany(nullifiers: readonly Bytes32[]): void {
    for (const nullifier of nullifiers) {
      this.add(nullifier);
    }
  }
}

export function buildBatchManifest(
  electionId: Bytes32,
  previousNullifierRoot: Bytes32,
  storedPackages: readonly StoredVotePackageV1[],
  accumulator: NullifierAccumulator,
): BatchManifestV1 {
  assertBytes32(electionId, "electionId");
  assertBytes32(previousNullifierRoot, "previousNullifierRoot");
  assert.equal(storedPackages.length > 0, true, "batch must include at least one package");
  assert.equal(
    accumulator.root,
    normalizeBytes32(previousNullifierRoot),
    "previousNullifierRoot does not match accumulator state",
  );

  const normalizedElectionId = normalizeBytes32(electionId);
  const normalizedPackages = storedPackages.map((storedPackage) => ({
    contentId: storedPackage.contentId.trim(),
    package: validateVotePackage(storedPackage.package),
  }));

  for (const [index, storedPackage] of normalizedPackages.entries()) {
    assert.equal(
      storedPackage.package.electionId,
      normalizedElectionId,
      `package[${index}] electionId mismatch`,
    );
  }

  const sortedPackages = [...normalizedPackages].sort((a, b) =>
    digestVotePackage(a.package).localeCompare(digestVotePackage(b.package)),
  );
  const batchNullifiers = sortedPackages.map(
    (storedPackage) => storedPackage.package.ballotNullifier,
  );
  accumulator.addMany(batchNullifiers);

  const packageDigests = sortedPackages.map((storedPackage) =>
    digestVotePackage(storedPackage.package),
  );
  const packageLeafHashes = sortedPackages.map(hashPackageLeaf);
  const cidMerkleRoot = merkleRoot(packageLeafHashes);
  const nullifierRoot = accumulator.root;
  const manifestDigest = keccak256(
    encodeAbiParameters(
      parseAbiParameters(
        "bytes32 domain, uint8 version, bytes32 electionId, bytes32 previousNullifierRoot, bytes32 nullifierRoot, bytes32 cidMerkleRoot, uint64 batchSize, bytes32[] packageDigests, bytes32[] ballotNullifiers",
      ),
      [
        domainHash("SVB_BATCH_MANIFEST_V1"),
        BATCH_MANIFEST_VERSION,
        normalizedElectionId,
        normalizeBytes32(previousNullifierRoot),
        nullifierRoot,
        cidMerkleRoot,
        BigInt(sortedPackages.length),
        packageDigests,
        batchNullifiers,
      ],
    ),
  );

  return {
    version: BATCH_MANIFEST_VERSION,
    electionId: normalizedElectionId,
    previousNullifierRoot: normalizeBytes32(previousNullifierRoot),
    nullifierRoot,
    cidMerkleRoot,
    manifestDigest,
    batchSize: BigInt(sortedPackages.length),
    packageDigests,
    packageLeafHashes,
    ballotNullifiers: batchNullifiers,
  };
}

export function buildInclusionReceipt(
  manifest: BatchManifestV1,
  packageDigest: Bytes32,
): PackageInclusionReceipt {
  const leafIndex = manifest.packageDigests.indexOf(normalizeBytes32(packageDigest));
  assert.equal(leafIndex >= 0, true, "package digest is not in manifest");
  const leafHash = manifest.packageLeafHashes[leafIndex]!;
  return {
    batchManifestDigest: manifest.manifestDigest,
    packageDigest: normalizeBytes32(packageDigest),
    leafHash,
    leafIndex,
    proof: merkleProof(manifest.packageLeafHashes, leafIndex),
  };
}
