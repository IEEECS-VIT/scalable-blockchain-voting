// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IEligibleBallotProofVerifier} from "../EligibleVotingContract.sol";

contract MockEligibleBallotProofVerifier is IEligibleBallotProofVerifier {
    mapping(bytes32 => bool) public accepted;

    function setAccepted(bytes32 publicInputsHash, bool value) external {
        accepted[publicInputsHash] = value;
    }

    function verify(
        bytes calldata proof,
        bytes32 publicInputsHash,
        bytes32,
        bytes32,
        bytes32,
        bytes32,
        bytes32
    ) external view returns (bool) {
        return proof.length > 0 && accepted[publicInputsHash];
    }
}
