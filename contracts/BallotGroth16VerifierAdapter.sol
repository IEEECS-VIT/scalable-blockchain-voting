// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IBallotGroth16Verifier {
    function verifyProof(
        uint256[2] calldata pA,
        uint256[2][2] calldata pB,
        uint256[2] calldata pC,
        uint256[22] calldata publicSignals
    ) external view returns (bool);
}

/// @notice Adapts snarkjs Groth16 calldata to VotingContract's compact proof
/// interface and prevents a proof from being paired with different public
/// inputs.
contract BallotGroth16VerifierAdapter {
    uint256 private constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;
    bytes32 public constant PUBLIC_INPUT_DOMAIN =
        keccak256("SVB_BABYJUB_BALLOT_PUBLIC_INPUTS_V1");

    IBallotGroth16Verifier public immutable verifier;

    constructor(IBallotGroth16Verifier verifier_) {
        verifier = verifier_;
    }

    function verify(
        bytes calldata proof,
        bytes32 publicInputsHash,
        bytes32 electionId,
        bytes32 ballotNullifier,
        bytes32 votePackageDigest
    ) external view returns (bool) {
        (
            uint256[2] memory pA,
            uint256[2][2] memory pB,
            uint256[2] memory pC,
            uint256[22] memory publicSignals
        ) = abi.decode(
                proof,
                (uint256[2], uint256[2][2], uint256[2], uint256[22])
            );

        if (
            publicSignals[0] != uint256(electionId) % SNARK_SCALAR_FIELD ||
            publicSignals[2] != uint256(ballotNullifier) % SNARK_SCALAR_FIELD ||
            publicSignals[3] != uint256(votePackageDigest)
        ) {
            return false;
        }
        if (
            keccak256(abi.encode(PUBLIC_INPUT_DOMAIN, publicSignals)) !=
            publicInputsHash
        ) {
            return false;
        }

        try verifier.verifyProof(pA, pB, pC, publicSignals) returns (
            bool accepted
        ) {
            return accepted;
        } catch {
            return false;
        }
    }
}
