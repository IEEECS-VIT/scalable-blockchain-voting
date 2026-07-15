// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

interface ICommittedBatchRoots {
    function isRootCommitted(bytes32 cidMerkleRoot)
        external
        view
        returns (bool);
}

/// @notice Records accountable claims when a batcher signs an intake receipt
/// but the package is not visibly included by its promised deadline.
/// @dev An open claim is public censorship evidence, not an automatic proof of
/// omission. Anyone can resolve it by supplying a valid Merkle inclusion proof
/// against a root already committed by BatchCommitment.
contract BatcherReceiptRegistry is Ownable, EIP712 {
    using ECDSA for bytes32;

    error InvalidReceipt();
    error InvalidReceiptSigner(address signer);
    error InclusionDeadlineNotReached(uint64 includeBy);
    error ClaimAlreadyExists(bytes32 receiptDigest);
    error ClaimNotOpen(bytes32 receiptDigest);
    error InvalidInclusionProof();

    bytes32 public constant RECEIPT_TYPEHASH = keccak256(
        "IntakeReceipt(bytes32 electionId,bytes32 eligibilityRoot,bytes32 packageDigest,bytes32 packageLeafHash,uint64 issuedAt,uint64 includeBy)"
    );
    bytes32 private constant MERKLE_PAIR_DOMAIN =
        keccak256("SVB_MERKLE_PAIR_V1");

    enum ClaimStatus {
        None,
        Open,
        Resolved
    }

    struct IntakeReceipt {
        bytes32 electionId;
        bytes32 eligibilityRoot;
        bytes32 packageDigest;
        bytes32 packageLeafHash;
        uint64 issuedAt;
        uint64 includeBy;
    }

    struct OmissionClaim {
        ClaimStatus status;
        address receiptSigner;
        address claimant;
        bytes32 packageDigest;
        bytes32 packageLeafHash;
        bytes32 eligibilityRoot;
        bytes32 resolvingBatchRoot;
        uint64 openedAt;
        uint64 resolvedAt;
    }

    bytes32 public immutable electionId;
    ICommittedBatchRoots public immutable batchCommitment;

    mapping(address signer => bool authorized) public isReceiptSigner;
    mapping(bytes32 receiptDigest => OmissionClaim claim) public claims;

    event ReceiptSignerAuthorizationChanged(
        address indexed signer,
        bool authorized
    );
    event OmissionClaimOpened(
        bytes32 indexed receiptDigest,
        bytes32 indexed packageDigest,
        address indexed receiptSigner,
        address claimant,
        bytes32 eligibilityRoot
    );
    event OmissionClaimResolved(
        bytes32 indexed receiptDigest,
        bytes32 indexed packageDigest,
        bytes32 indexed committedBatchRoot
    );

    constructor(
        bytes32 electionId_,
        address initialOwner,
        ICommittedBatchRoots batchCommitment_,
        address initialReceiptSigner
    ) Ownable(initialOwner) EIP712("ScalableVotingBatcherReceipt", "1") {
        if (
            electionId_ == bytes32(0) ||
            address(batchCommitment_) == address(0) ||
            initialReceiptSigner == address(0)
        ) revert InvalidReceipt();
        electionId = electionId_;
        batchCommitment = batchCommitment_;
        isReceiptSigner[initialReceiptSigner] = true;
        emit ReceiptSignerAuthorizationChanged(initialReceiptSigner, true);
    }

    function setReceiptSigner(address signer, bool authorized)
        external
        onlyOwner
    {
        if (signer == address(0)) revert InvalidReceiptSigner(signer);
        isReceiptSigner[signer] = authorized;
        emit ReceiptSignerAuthorizationChanged(signer, authorized);
    }

    function receiptDigest(IntakeReceipt calldata receipt)
        public
        view
        returns (bytes32)
    {
        return _hashTypedDataV4(keccak256(abi.encode(
            RECEIPT_TYPEHASH,
            receipt.electionId,
            receipt.eligibilityRoot,
            receipt.packageDigest,
            receipt.packageLeafHash,
            receipt.issuedAt,
            receipt.includeBy
        )));
    }

    function verifyReceipt(
        IntakeReceipt calldata receipt,
        bytes calldata signature
    ) public view returns (address signer) {
        _validateReceipt(receipt);
        signer = receiptDigest(receipt).recover(signature);
        if (!isReceiptSigner[signer]) revert InvalidReceiptSigner(signer);
    }

    function openOmissionClaim(
        IntakeReceipt calldata receipt,
        bytes calldata signature
    ) external returns (bytes32 digest) {
        if (block.timestamp <= receipt.includeBy) {
            revert InclusionDeadlineNotReached(receipt.includeBy);
        }
        address signer = verifyReceipt(receipt, signature);
        digest = receiptDigest(receipt);
        if (claims[digest].status != ClaimStatus.None) {
            revert ClaimAlreadyExists(digest);
        }
        claims[digest] = OmissionClaim({
            status: ClaimStatus.Open,
            receiptSigner: signer,
            claimant: msg.sender,
            packageDigest: receipt.packageDigest,
            packageLeafHash: receipt.packageLeafHash,
            eligibilityRoot: receipt.eligibilityRoot,
            resolvingBatchRoot: bytes32(0),
            openedAt: uint64(block.timestamp),
            resolvedAt: 0
        });
        emit OmissionClaimOpened(
            digest,
            receipt.packageDigest,
            signer,
            msg.sender,
            receipt.eligibilityRoot
        );
    }

    function resolveWithInclusion(
        bytes32 digest,
        bytes32 committedBatchRoot,
        bytes32[] calldata siblings,
        bool[] calldata siblingIsLeft
    ) external {
        OmissionClaim storage claim = claims[digest];
        if (claim.status != ClaimStatus.Open) revert ClaimNotOpen(digest);
        if (
            !batchCommitment.isRootCommitted(committedBatchRoot) ||
            siblings.length != siblingIsLeft.length
        ) revert InvalidInclusionProof();

        bytes32 cursor = claim.packageLeafHash;
        for (uint256 i = 0; i < siblings.length; ++i) {
            cursor = siblingIsLeft[i]
                ? _hashPair(siblings[i], cursor)
                : _hashPair(cursor, siblings[i]);
        }
        if (cursor != committedBatchRoot) revert InvalidInclusionProof();

        claim.status = ClaimStatus.Resolved;
        claim.resolvingBatchRoot = committedBatchRoot;
        claim.resolvedAt = uint64(block.timestamp);
        emit OmissionClaimResolved(
            digest,
            claim.packageDigest,
            committedBatchRoot
        );
    }

    function _validateReceipt(IntakeReceipt calldata receipt) private view {
        if (
            receipt.electionId != electionId ||
            receipt.eligibilityRoot == bytes32(0) ||
            receipt.packageDigest == bytes32(0) ||
            receipt.packageLeafHash == bytes32(0) ||
            receipt.issuedAt == 0 ||
            receipt.includeBy <= receipt.issuedAt
        ) revert InvalidReceipt();
    }

    function _hashPair(bytes32 left, bytes32 right)
        private
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(MERKLE_PAIR_DOMAIN, left, right));
    }
}
