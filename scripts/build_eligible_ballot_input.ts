import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { keccak256, stringToHex } from "viem";

import {
  buildEligibilityMembership,
  buildEligibleBallotWitness,
  flattenEligibleBallotPublicSignals,
  hashEligibleBallotPublicSignals,
  type EligibilityCredential,
} from "../packages/crypto/src/eligibleBallot.js";
import { createProofCompatibleElectionKeyPair } from "../packages/crypto/src/proofCompatibleBallot.js";

const outputPath = path.resolve(
  process.argv[2] ?? "circuits/build/eligible_ballot/input.json",
);
const selectedIndex = Number(process.argv[3] ?? "1");
const credentialNumber = Number(process.argv[4] ?? "1");

const credentials: readonly EligibilityCredential[] = [
  { secret: 101n, nonce: 1001n, index: 17 },
  { secret: 202n, nonce: 2002n, index: 924 },
  { secret: 303n, nonce: 3003n, index: 70_001 },
];
if (!Number.isInteger(credentialNumber) || credentialNumber < 1 || credentialNumber > credentials.length) {
  throw new Error(`credentialNumber must be between 1 and ${credentials.length}`);
}
const credential = credentials[credentialNumber - 1]!;
const membership = await buildEligibilityMembership({
  credentials,
  targetIndex: credential.index,
});
const electionId = keccak256(stringToHex("scalable-voting-demo-2026"));
const candidateListHash = keccak256(
  stringToHex("candidate-a,candidate-b,candidate-c,candidate-d"),
);
const electionKey = await createProofCompatibleElectionKeyPair(7n);
const { witness } = await buildEligibleBallotWitness({
  electionId,
  candidateListHash,
  electionPublicKey: electionKey.publicKey,
  credential,
  membership,
  selectedIndex,
  randomness: [17n, 18n, 19n, 20n].map(
    (value) => value + BigInt(credentialNumber - 1) * 10n,
  ),
});
const publicSignals = flattenEligibleBallotPublicSignals(witness);

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(witness, null, 2)}\n`);
console.log(JSON.stringify({
  inputPath: path.relative(process.cwd(), outputPath),
  selectedIndex,
  credentialNumber,
  credentialIndex: credential.index,
  eligibilityRoot: `0x${membership.eligibilityRoot.toString(16).padStart(64, "0")}`,
  ballotNullifier: `0x${BigInt(witness.ballotNullifier).toString(16).padStart(64, "0")}`,
  packageCommitment: `0x${BigInt(witness.packageCommitment).toString(16).padStart(64, "0")}`,
  publicInputsHash: hashEligibleBallotPublicSignals(publicSignals),
}, null, 2));
