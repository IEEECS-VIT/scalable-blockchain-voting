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
const DEFAULT_ELIGIBILITY_ROOT =
  "0x12949861ba7288c9ddfecdd8951e7624967f79a6c803a9fc399ac6a36de59070";

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
  const eligibilityRoot = m.getParameter(
    "eligibilityRoot",
    DEFAULT_ELIGIBILITY_ROOT,
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
  const ballotGroth16Verifier = m.contract("BallotGroth16Verifier");
  const ballotProofVerifier = m.contract("BallotGroth16VerifierAdapter", [
    ballotGroth16Verifier,
  ]);
  const votingContract = m.contract("VotingContract", [
    electionId,
    candidateListHash,
    voterRegistry,
    owner,
    ballotProofVerifier,
  ]);
  const eligibilityRootRegistry = m.contract("EligibilityRootRegistry", [
    electionId,
    eligibilityRoot,
    owner,
  ]);
  m.call(eligibilityRootRegistry, "freezeRoot");
  const eligibleBallotGroth16Verifier = m.contract(
    "EligibleBallotGroth16Verifier",
  );
  const eligibleBallotProofVerifier = m.contract(
    "EligibleBallotGroth16VerifierAdapter",
    [eligibleBallotGroth16Verifier],
  );
  const eligibleVotingContract = m.contract("EligibleVotingContract", [
    electionId,
    candidateListHash,
    eligibilityRootRegistry,
    eligibleBallotProofVerifier,
    owner,
  ]);
  const batchCommitment = m.contract("BatchCommitment", [
    electionId,
    owner,
    owner,
    batchProofVerifier,
  ]);
  const batcherReceiptRegistry = m.contract("BatcherReceiptRegistry", [
    electionId,
    owner,
    batchCommitment,
    owner,
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
    eligibilityRootRegistry,
    eligibleBallotGroth16Verifier,
    eligibleBallotProofVerifier,
    eligibleVotingContract,
    ballotGroth16Verifier,
    ballotProofVerifier,
    batchCommitment,
    batcherReceiptRegistry,
    tallyVerifier,
  };
});
