import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { keccak256, stringToHex, type Address, zeroAddress } from "viem";

const DEFAULT_ELECTION_ID = keccak256(
  stringToHex("scalable-voting-demo-2026"),
);

export default buildModule("AnonAadhaarAdapter", (m) => {
  const anonAadhaar = m.getParameter<Address>("anonAadhaar", zeroAddress);
  const electionId = m.getParameter("electionId", DEFAULT_ELECTION_ID);
  const maxProofAge = m.getParameter("maxProofAge", 86_400n);

  const eligibilityVerifier = m.contract("AnonAadhaarEligibilityVerifier", [
    anonAadhaar,
    electionId,
    maxProofAge,
  ]);

  return { eligibilityVerifier };
});
