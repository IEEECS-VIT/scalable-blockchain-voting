// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IAnonAadhaar} from "@anon-aadhaar/contracts/interfaces/IAnonAadhaar.sol";

/// @notice Verifies an official Anon Aadhaar proof and binds its election-
/// scoped nullifier and signal to the exact registration accepted on-chain.
contract AnonAadhaarEligibilityVerifier {
    uint256 private constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;
    bytes32 public constant REGISTRATION_DOMAIN =
        keccak256("SVB_REGISTRATION_PUBLIC_INPUTS_V1");
    bytes32 public constant SIGNAL_DOMAIN =
        keccak256("SVB_ANON_AADHAAR_REGISTRATION_SIGNAL_V1");

    IAnonAadhaar public immutable anonAadhaar;
    bytes32 public immutable electionId;
    uint256 public immutable maxProofAge;

    constructor(
        IAnonAadhaar anonAadhaar_,
        bytes32 electionId_,
        uint256 maxProofAge_
    ) {
        require(address(anonAadhaar_) != address(0), "zero Anon Aadhaar");
        require(maxProofAge_ > 0, "zero proof age");
        anonAadhaar = anonAadhaar_;
        electionId = electionId_;
        maxProofAge = maxProofAge_;
    }

    function registrationSignal(
        bytes32 identityNullifier,
        address votingKey
    ) public view returns (uint256) {
        return uint256(
            keccak256(
                abi.encode(
                    SIGNAL_DOMAIN,
                    electionId,
                    identityNullifier,
                    votingKey
                )
            )
        );
    }

    function verify(
        bytes calldata proof,
        bytes32 publicInputsHash,
        bytes32 suppliedElectionId,
        bytes32 identityNullifier,
        address votingKey
    ) external view returns (bool) {
        if (suppliedElectionId != electionId || votingKey == address(0)) {
            return false;
        }
        uint256 nullifier = uint256(identityNullifier);
        if (nullifier == 0 || nullifier >= SNARK_SCALAR_FIELD) return false;
        if (
            publicInputsHash !=
            keccak256(
                abi.encode(
                    REGISTRATION_DOMAIN,
                    electionId,
                    identityNullifier,
                    votingKey
                )
            )
        ) return false;

        (
            uint256 nullifierSeed,
            uint256 proofNullifier,
            uint256 timestamp,
            uint256 signal,
            uint256[4] memory revealArray,
            uint256[8] memory groth16Proof
        ) = abi.decode(
                proof,
                (uint256, uint256, uint256, uint256, uint256[4], uint256[8])
            );
        if (
            nullifierSeed != uint256(electionId) % SNARK_SCALAR_FIELD ||
            proofNullifier != nullifier ||
            signal != registrationSignal(identityNullifier, votingKey) ||
            timestamp > block.timestamp ||
            block.timestamp - timestamp > maxProofAge
        ) return false;

        try anonAadhaar.verifyAnonAadhaarProof(
            nullifierSeed,
            proofNullifier,
            timestamp,
            signal,
            revealArray,
            groth16Proof
        ) returns (bool accepted) {
            return accepted;
        } catch {
            return false;
        }
    }
}
