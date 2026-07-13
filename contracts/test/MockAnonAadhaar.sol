// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IAnonAadhaar} from "@anon-aadhaar/contracts/interfaces/IAnonAadhaar.sol";

contract MockAnonAadhaar is IAnonAadhaar {
    bool public accepted;

    function setAccepted(bool accepted_) external {
        accepted = accepted_;
    }

    function verifyAnonAadhaarProof(
        uint256,
        uint256,
        uint256,
        uint256,
        uint256[4] memory,
        uint256[8] memory
    ) external view returns (bool) {
        return accepted;
    }
}
