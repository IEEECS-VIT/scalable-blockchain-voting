// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IEligibleBallotGroth16Verifier {
    function verifyProof(
        uint256[2] calldata pA,
        uint256[2][2] calldata pB,
        uint256[2] calldata pC,
        uint256[23] calldata publicSignals
    ) external view returns (bool);
}

/// @notice Binds a generated V3 Groth16 proof to the exact election,
/// eligibility root, nullifier, ciphertext package and contract call.
contract EligibleBallotGroth16VerifierAdapter {
    uint256 private constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;
    bytes32 public constant PUBLIC_INPUT_DOMAIN =
        keccak256("SVB_ELIGIBLE_BALLOT_PUBLIC_INPUTS_V1");

    IEligibleBallotGroth16Verifier public immutable verifier;

    constructor(IEligibleBallotGroth16Verifier verifier_) {
        require(address(verifier_) != address(0), "zero verifier");
        verifier = verifier_;
    }

    function verify(
        bytes calldata proof,
        bytes32 publicInputsHash,
        bytes32 electionId,
        bytes32 candidateListHash,
        bytes32 eligibilityRoot,
        bytes32 ballotNullifier,
        bytes32 votePackageDigest
    ) external view returns (bool) {
        (
            uint256[2] memory pA,
            uint256[2][2] memory pB,
            uint256[2] memory pC,
            uint256[23] memory publicSignals
        ) = abi.decode(
                proof,
                (uint256[2], uint256[2][2], uint256[2], uint256[23])
            );
        if (
            publicSignals[0] != uint256(electionId) % SNARK_SCALAR_FIELD ||
            publicSignals[1] != uint256(candidateListHash) % SNARK_SCALAR_FIELD ||
            publicSignals[2] != uint256(eligibilityRoot) ||
            publicSignals[3] != uint256(ballotNullifier) ||
            publicSignals[4] != uint256(votePackageDigest)
        ) return false;
        if (
            keccak256(abi.encode(PUBLIC_INPUT_DOMAIN, publicSignals)) !=
            publicInputsHash
        ) return false;
        try verifier.verifyProof(pA, pB, pC, publicSignals) returns (
            bool accepted
        ) {
            return accepted;
        } catch {
            return false;
        }
    }
}
