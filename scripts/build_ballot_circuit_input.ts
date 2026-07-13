import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { keccak256, stringToHex } from "viem";

import {
  buildProofCompatibleBallotWitness,
  bytes32ToSnarkField,
  createProofCompatibleElectionKeyPair,
  encryptProofCompatibleBallot,
  flattenProofCompatibleBallotPublicSignals,
  hashProofCompatibleBallotPublicSignals,
} from "../packages/crypto/src/proofCompatibleBallot.js";

const outputPath = path.resolve(
  process.argv[2] ?? "circuits/build/ballot_validity/input.json",
);
const selectedIndex = Number(process.argv[3] ?? "1");
const ballotLabel = process.argv[4] ?? "1";

const electionKey = await createProofCompatibleElectionKeyPair(7n);
const encrypted = await encryptProofCompatibleBallot({
  electionPublicKey: electionKey.publicKey,
  selectedIndex,
  randomness: [17n, 18n, 19n, 20n],
});
const ballotNullifierField = bytes32ToSnarkField(
  keccak256(stringToHex(`demo-ballot-nullifier-${ballotLabel}`)),
);
const ballotNullifier =
  `0x${ballotNullifierField.toString(16).padStart(64, "0")}` as const;
const witness = await buildProofCompatibleBallotWitness({
  electionId: keccak256(stringToHex("scalable-voting-demo-2026")),
  candidateListHash: keccak256(
    stringToHex("candidate-a,candidate-b,candidate-c,candidate-d"),
  ),
  ballotNullifier,
  electionPublicKey: electionKey.publicKey,
  ciphertext: encrypted.ciphertext,
  selection: encrypted.selection,
  randomness: encrypted.randomness,
});
const publicSignals = flattenProofCompatibleBallotPublicSignals(witness);

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify(witness, (_, value) =>
    typeof value === "bigint" ? value.toString() : value, 2)}\n`,
);

console.log(
  JSON.stringify(
    {
      inputPath: path.relative(process.cwd(), outputPath),
      selectedIndex,
      ballotLabel,
      electionPublicKeyHash: electionKey.publicKeyHash,
      packageCommitment: `0x${witness.packageCommitment.toString(16).padStart(64, "0")}`,
      publicInputsHash: hashProofCompatibleBallotPublicSignals(publicSignals),
    },
    null,
    2,
  ),
);
