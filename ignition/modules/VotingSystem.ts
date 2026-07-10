import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { keccak256, stringToHex, type Address, zeroAddress } from "viem";

const DEFAULT_ELECTION_ID = keccak256(
  stringToHex("scalable-voting-demo-2026"),
);
const DEFAULT_CANDIDATE_LIST_HASH = keccak256(
  stringToHex("candidate-a,candidate-b"),
);
const DEFAULT_PUBLIC_KEY_HASH = keccak256(
  stringToHex("replace-with-demo-election-public-key"),
);

export default buildModule("VotingSystem", (m) => {
  const owner = m.getAccount(0);
  const electionId = m.getParameter("electionId", DEFAULT_ELECTION_ID);
  const candidateListHash = m.getParameter(
    "candidateListHash",
    DEFAULT_CANDIDATE_LIST_HASH,
  );
  const electionPublicKeyHash = m.getParameter(
    "electionPublicKeyHash",
    DEFAULT_PUBLIC_KEY_HASH,
  );
  const eligibilityVerifier = m.getParameter<Address>(
    "eligibilityVerifier",
    zeroAddress,
  );
  const tallyProofVerifier = m.getParameter<Address>(
    "tallyProofVerifier",
    zeroAddress,
  );
  const batchProofVerifier = m.getParameter<Address>(
    "batchProofVerifier",
    zeroAddress,
  );
  const votingStartsAt = m.getParameter(
    "votingStartsAt",
    1_900_000_000n,
  );
  const votingEndsAt = m.getParameter(
    "votingEndsAt",
    1_900_604_800n,
  );

  const electionConfig = m.contract("ElectionConfig", [
    electionId,
    candidateListHash,
    electionPublicKeyHash,
    votingStartsAt,
    votingEndsAt,
  ]);
  const voterRegistry = m.contract("VoterRegistry", [
    electionId,
    owner,
    eligibilityVerifier,
  ]);
  const votingContract = m.contract("VotingContract", [
    electionId,
    voterRegistry,
  ]);
  const batchCommitment = m.contract("BatchCommitment", [
    electionId,
    owner,
    owner,
    batchProofVerifier,
  ]);
  const tallyVerifier = m.contract("TallyVerifier", [
    electionId,
    owner,
    tallyProofVerifier,
  ]);

  return {
    electionConfig,
    voterRegistry,
    votingContract,
    batchCommitment,
    tallyVerifier,
  };
});
