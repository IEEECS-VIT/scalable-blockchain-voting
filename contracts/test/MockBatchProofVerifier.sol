// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IBatchProofVerifier} from "../BatchCommitment.sol";

/// @notice Test-only verifier for the BatchCommitment proof seam.
/// @dev This is not a SNARK verifier. It lets tests exercise proof-gated
/// batch submission while keeping mock verification visibly isolated.
contract MockBatchProofVerifier is IBatchProofVerifier {
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
