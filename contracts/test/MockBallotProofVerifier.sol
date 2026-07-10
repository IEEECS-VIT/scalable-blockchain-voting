// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IBallotProofVerifier} from "../VotingContract.sol";

/// @notice Test-only verifier for the VotingContract ballot-proof seam.
/// @dev This is not a SNARK verifier. It only lets tests exercise the adapter
/// path until a real ballot-validity verifier is generated.
contract MockBallotProofVerifier is IBallotProofVerifier {
    mapping(bytes32 publicInputsHash => bool accepted) public acceptedHashes;

    event AcceptedHashChanged(
        bytes32 indexed publicInputsHash,
        bool accepted
    );

    function setAccepted(
        bytes32 publicInputsHash,
        bool accepted
    ) external {
        acceptedHashes[publicInputsHash] = accepted;
        emit AcceptedHashChanged(publicInputsHash, accepted);
    }

    function verify(
        bytes calldata,
        bytes32 publicInputsHash
    ) external view returns (bool) {
        return acceptedHashes[publicInputsHash];
    }
}
