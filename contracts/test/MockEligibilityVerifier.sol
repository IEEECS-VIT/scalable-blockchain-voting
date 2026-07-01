// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IEligibilityVerifier} from "../VoterRegistry.sol";

/// @notice Test-only verifier used to exercise the registry integration seam.
/// @dev This is not an Anon Aadhaar verifier and must not be deployed as one.
contract MockEligibilityVerifier is IEligibilityVerifier {
    mapping(bytes32 publicInputsHash => bool accepted) public isAccepted;

    function setAccepted(
        bytes32 publicInputsHash,
        bool accepted
    ) external {
        isAccepted[publicInputsHash] = accepted;
    }

    function verify(
        bytes calldata proof,
        bytes32 publicInputsHash
    ) external view returns (bool) {
        return proof.length > 0 && isAccepted[publicInputsHash];
    }
}
