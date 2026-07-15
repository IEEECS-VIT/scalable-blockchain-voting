// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Stores one active anonymous-credential root for an election.
/// @dev Replacing per-voter registration with one root update removes the
/// national-scale registration transaction bottleneck. Credential issuance
/// and legal electoral-roll governance remain external authority functions.
contract EligibilityRootRegistry is Ownable {
    error InvalidEligibilityRoot();
    error EligibilityRootUnchanged();
    error EligibilityRootIsFrozen();
    error EligibilityRootAlreadyFrozen();

    bytes32 public immutable electionId;
    bytes32 public currentRoot;
    uint64 public rootVersion;
    bool public rootFrozen;

    event EligibilityRootUpdated(
        bytes32 indexed previousRoot,
        bytes32 indexed newRoot,
        uint64 indexed version
    );
    event EligibilityRootFrozen(bytes32 indexed root, uint64 indexed version);

    constructor(
        bytes32 electionId_,
        bytes32 initialRoot,
        address initialOwner
    ) Ownable(initialOwner) {
        if (electionId_ == bytes32(0) || initialRoot == bytes32(0)) {
            revert InvalidEligibilityRoot();
        }
        electionId = electionId_;
        currentRoot = initialRoot;
        rootVersion = 1;
        emit EligibilityRootUpdated(bytes32(0), initialRoot, 1);
    }

    function updateRoot(bytes32 newRoot) external onlyOwner {
        if (rootFrozen) revert EligibilityRootIsFrozen();
        if (newRoot == bytes32(0)) revert InvalidEligibilityRoot();
        bytes32 previousRoot = currentRoot;
        if (newRoot == previousRoot) revert EligibilityRootUnchanged();
        uint64 version = rootVersion + 1;
        currentRoot = newRoot;
        rootVersion = version;
        emit EligibilityRootUpdated(previousRoot, newRoot, version);
    }

    /// @notice Permanently locks the electoral-roll commitment before voting.
    function freezeRoot() external onlyOwner {
        if (rootFrozen) revert EligibilityRootAlreadyFrozen();
        rootFrozen = true;
        emit EligibilityRootFrozen(currentRoot, rootVersion);
    }

    function isCurrentRoot(bytes32 root) external view returns (bool) {
        return root != bytes32(0) && root == currentRoot;
    }
}
