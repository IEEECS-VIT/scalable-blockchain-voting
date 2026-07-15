// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EligibilityRootRegistry} from "./EligibilityRootRegistry.sol";

interface IEligibleBallotProofVerifier {
    function verify(
        bytes calldata proof,
        bytes32 publicInputsHash,
        bytes32 electionId,
        bytes32 candidateListHash,
        bytes32 eligibilityRoot,
        bytes32 ballotNullifier,
        bytes32 votePackageDigest
    ) external view returns (bool);
}

/// @notice Reference direct-submission path for the unified V3 proof.
/// @dev Any relayer may submit because eligibility and one-person-one-vote are
/// proved cryptographically. The scalable path will aggregate these proofs in
/// a batch instead of sending one transaction per ballot.
contract EligibleVotingContract is Ownable {
    uint256 private constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    error EligibilityRootNotCurrent();
    error EligibilityRootNotFrozen();
    error InvalidPublicInputs();
    error NullifierAlreadyUsed(bytes32 nullifier);
    error ProofRejected();
    error VerifierNotConfigured();

    bytes32 public immutable electionId;
    bytes32 public immutable candidateListHash;
    EligibilityRootRegistry public immutable eligibilityRoots;
    IEligibleBallotProofVerifier public verifier;

    mapping(bytes32 nullifier => bool used) public isNullifierUsed;

    event EligibleBallotCommitted(
        bytes32 indexed ballotNullifier,
        bytes32 indexed eligibilityRoot,
        bytes32 votePackageDigest,
        address indexed relayer
    );
    event VerifierUpdated(address indexed verifier);

    constructor(
        bytes32 electionId_,
        bytes32 candidateListHash_,
        EligibilityRootRegistry eligibilityRoots_,
        IEligibleBallotProofVerifier verifier_,
        address initialOwner
    ) Ownable(initialOwner) {
        electionId = electionId_;
        candidateListHash = candidateListHash_;
        eligibilityRoots = eligibilityRoots_;
        verifier = verifier_;
    }

    function setVerifier(IEligibleBallotProofVerifier verifier_) external onlyOwner {
        verifier = verifier_;
        emit VerifierUpdated(address(verifier_));
    }

    function submitEligibleBallot(
        bytes32 eligibilityRoot,
        bytes32 ballotNullifier,
        bytes32 votePackageDigest,
        bytes32 publicInputsHash,
        bytes calldata proof
    ) external {
        if (!eligibilityRoots.rootFrozen()) revert EligibilityRootNotFrozen();
        if (!eligibilityRoots.isCurrentRoot(eligibilityRoot)) {
            revert EligibilityRootNotCurrent();
        }
        if (
            uint256(eligibilityRoot) >= SNARK_SCALAR_FIELD ||
            uint256(ballotNullifier) == 0 ||
            uint256(ballotNullifier) >= SNARK_SCALAR_FIELD ||
            uint256(votePackageDigest) == 0 ||
            uint256(votePackageDigest) >= SNARK_SCALAR_FIELD ||
            publicInputsHash == bytes32(0)
        ) revert InvalidPublicInputs();
        if (isNullifierUsed[ballotNullifier]) {
            revert NullifierAlreadyUsed(ballotNullifier);
        }
        IEligibleBallotProofVerifier proofVerifier = verifier;
        if (address(proofVerifier) == address(0)) revert VerifierNotConfigured();
        if (!proofVerifier.verify(
            proof,
            publicInputsHash,
            electionId,
            candidateListHash,
            eligibilityRoot,
            ballotNullifier,
            votePackageDigest
        )) revert ProofRejected();
        isNullifierUsed[ballotNullifier] = true;
        emit EligibleBallotCommitted(
            ballotNullifier,
            eligibilityRoot,
            votePackageDigest,
            msg.sender
        );
    }
}
