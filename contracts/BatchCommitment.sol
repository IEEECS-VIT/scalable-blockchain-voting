// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IBatchProofVerifier {
    function verify(
        bytes calldata proof,
        bytes32 publicInputsHash
    ) external view returns (bool);
}

/// @notice Append-only trusted-demo batch commitments.
/// @dev Root submission is not a batch-validity proof. The authorized batcher
/// remains trusted until a verifier for ballot validity and state transition
/// is integrated.
contract BatchCommitment is Ownable {
    error InvalidBatch();
    error NoBatchVerifier();
    error BatchProofRejected();
    error UnauthorizedBatcher(address caller);
    error NullifierRootMismatch(
        bytes32 expectedPreviousRoot,
        bytes32 suppliedPreviousRoot
    );
    error RootAlreadyCommitted(bytes32 cidMerkleRoot);

    struct Batch {
        bytes32 cidMerkleRoot;
        bytes32 previousNullifierRoot;
        bytes32 nullifierRoot;
        bytes32 manifestDigest;
        bytes32 batchPublicInputsHash;
        uint64 batchSize;
        uint64 submittedAt;
        address batcher;
    }

    bytes32 public immutable electionId;
    bytes32 public latestNullifierRoot;
    uint256 public batchCount;
    IBatchProofVerifier public batchProofVerifier;

    mapping(address batcher => bool authorized) public isBatcher;
    mapping(bytes32 cidMerkleRoot => bool committed) public isRootCommitted;
    mapping(uint256 batchIndex => Batch batch) private batches;

    event BatcherAuthorizationChanged(
        address indexed batcher,
        bool authorized
    );
    event BatchCommitted(
        uint256 indexed batchIndex,
        bytes32 indexed cidMerkleRoot,
        bytes32 previousNullifierRoot,
        bytes32 nullifierRoot,
        bytes32 manifestDigest,
        bytes32 batchPublicInputsHash,
        uint64 batchSize,
        address indexed batcher
    );
    event BatchProofVerifierChanged(address indexed verifier);

    constructor(
        bytes32 electionId_,
        address initialOwner,
        address initialBatcher,
        IBatchProofVerifier initialBatchProofVerifier
    ) Ownable(initialOwner) {
        electionId = electionId_;
        batchProofVerifier = initialBatchProofVerifier;
        _setBatcher(initialBatcher, true);
        emit BatchProofVerifierChanged(address(initialBatchProofVerifier));
    }

    function setBatcher(address batcher, bool authorized) external onlyOwner {
        _setBatcher(batcher, authorized);
    }

    function setBatchProofVerifier(
        IBatchProofVerifier verifier
    ) external onlyOwner {
        batchProofVerifier = verifier;
        emit BatchProofVerifierChanged(address(verifier));
    }

    /// @notice Trusted demo path. The authorized batcher is responsible for
    /// validating package availability, nullifier uniqueness, and aggregation.
    function submitBatch(
        bytes32 cidMerkleRoot,
        bytes32 previousNullifierRoot,
        bytes32 nullifierRoot,
        bytes32 manifestDigest,
        uint64 batchSize
    ) external returns (uint256 batchIndex) {
        if (!isBatcher[msg.sender]) revert UnauthorizedBatcher(msg.sender);
        return _commitBatch(
            cidMerkleRoot,
            previousNullifierRoot,
            nullifierRoot,
            manifestDigest,
            bytes32(0),
            batchSize
        );
    }

    /// @notice Proof-gated path for the scalable batch design.
    /// @dev The verifier must prove that `batchPublicInputsHash` binds the
    /// committed roots, manifest, nullifier transition, and ballot validity.
    /// This function does not authorize the sender as a trusted batcher.
    function submitBatchWithProof(
        bytes32 cidMerkleRoot,
        bytes32 previousNullifierRoot,
        bytes32 nullifierRoot,
        bytes32 manifestDigest,
        bytes32 batchPublicInputsHash,
        uint64 batchSize,
        bytes calldata proof
    ) external returns (uint256 batchIndex) {
        if (batchPublicInputsHash == bytes32(0)) revert InvalidBatch();
        IBatchProofVerifier verifier = batchProofVerifier;
        if (address(verifier) == address(0)) revert NoBatchVerifier();
        if (!verifier.verify(proof, batchPublicInputsHash)) {
            revert BatchProofRejected();
        }
        return _commitBatch(
            cidMerkleRoot,
            previousNullifierRoot,
            nullifierRoot,
            manifestDigest,
            batchPublicInputsHash,
            batchSize
        );
    }

    function getBatch(uint256 batchIndex)
        external
        view
        returns (Batch memory)
    {
        return batches[batchIndex];
    }

    function _setBatcher(address batcher, bool authorized) private {
        if (batcher == address(0)) revert UnauthorizedBatcher(batcher);
        isBatcher[batcher] = authorized;
        emit BatcherAuthorizationChanged(batcher, authorized);
    }

    function _commitBatch(
        bytes32 cidMerkleRoot,
        bytes32 previousNullifierRoot,
        bytes32 nullifierRoot,
        bytes32 manifestDigest,
        bytes32 batchPublicInputsHash,
        uint64 batchSize
    ) private returns (uint256 batchIndex) {
        if (
            cidMerkleRoot == bytes32(0) ||
            nullifierRoot == bytes32(0) ||
            manifestDigest == bytes32(0) ||
            batchSize == 0
        ) revert InvalidBatch();
        if (previousNullifierRoot != latestNullifierRoot) {
            revert NullifierRootMismatch(
                latestNullifierRoot,
                previousNullifierRoot
            );
        }
        if (isRootCommitted[cidMerkleRoot]) {
            revert RootAlreadyCommitted(cidMerkleRoot);
        }

        batchIndex = batchCount;
        batches[batchIndex] = Batch({
            cidMerkleRoot: cidMerkleRoot,
            previousNullifierRoot: previousNullifierRoot,
            nullifierRoot: nullifierRoot,
            manifestDigest: manifestDigest,
            batchPublicInputsHash: batchPublicInputsHash,
            batchSize: batchSize,
            submittedAt: uint64(block.timestamp),
            batcher: msg.sender
        });

        batchCount = batchIndex + 1;
        latestNullifierRoot = nullifierRoot;
        isRootCommitted[cidMerkleRoot] = true;

        emit BatchCommitted(
            batchIndex,
            cidMerkleRoot,
            previousNullifierRoot,
            nullifierRoot,
            manifestDigest,
            batchPublicInputsHash,
            batchSize,
            msg.sender
        );
    }
}
