import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { encodeAbiParameters, keccak256, parseAbiParameters, stringToHex } from "viem";

import { createProofCompatibleThresholdKeySet } from
  "../packages/crypto/src/proofCompatibleThreshold.js";

type CeremonyConfig = {
  threshold?: number;
  trusteeCount?: number;
  privateKey?: string;
  coefficients?: readonly string[];
};

const configPath = process.argv[2];
const outputDirectory = process.argv[3];
if (configPath === undefined || outputDirectory === undefined) {
  throw new Error("usage: npm run ceremony:threshold -- ceremony-config.json output-directory");
}
const config = JSON.parse(await readFile(path.resolve(configPath), "utf8")) as CeremonyConfig;
const threshold = config.threshold ?? 5;
const trusteeCount = config.trusteeCount ?? 9;
const keySet = await createProofCompatibleThresholdKeySet({
  threshold,
  trusteeCount,
  privateKey: config.privateKey === undefined ? undefined : BigInt(config.privateKey),
  coefficients: config.coefficients?.map(BigInt),
});
const publicShares = keySet.shares.map(({ trusteeIndex, publicShare }) => ({
  trusteeIndex,
  publicShare,
}));
const ceremonyModel = "demo-dealer-generated-shamir-v1" as const;
const transcriptDigest = keccak256(encodeAbiParameters(
  parseAbiParameters(
    "bytes32 domain, bytes32 ceremonyModel, uint32 threshold, uint32 trusteeCount, bytes32 publicKeyHash, uint256[] publicShareCoordinates",
  ),
  [
    keccak256(stringToHex("SVB_THRESHOLD_CEREMONY_V1")),
    keccak256(stringToHex(ceremonyModel)),
    threshold,
    trusteeCount,
    keySet.publicKeyHash,
    publicShares.flatMap((share) => share.publicShare.map(BigInt)),
  ],
));
const resolvedOutputDirectory = path.resolve(outputDirectory);
await mkdir(resolvedOutputDirectory, { recursive: true });
await writeFile(path.join(resolvedOutputDirectory, "threshold-public-keyset.json"), `${JSON.stringify({
  version: 1,
  ceremonyModel,
  warning: "Demo dealer ceremony; production requires an audited distributed key generation protocol.",
  threshold,
  trusteeCount,
  publicKey: keySet.publicKey,
  publicKeyHash: keySet.publicKeyHash,
  trusteePublicShares: publicShares,
  transcriptDigest,
}, null, 2)}\n`);
await Promise.all(keySet.shares.map((share) => writeFile(
  path.join(resolvedOutputDirectory, `trustee-${share.trusteeIndex}-private-share.json`),
  `${JSON.stringify({
    version: 1,
    ceremonyModel,
    transcriptDigest,
    electionPublicKeyHash: keySet.publicKeyHash,
    ...share,
  }, null, 2)}\n`,
  { mode: 0o600 },
)));
console.log(JSON.stringify({
  outputDirectory: resolvedOutputDirectory,
  ceremonyModel,
  threshold,
  trusteeCount,
  electionPublicKeyHash: keySet.publicKeyHash,
  transcriptDigest,
  privateShareFiles: keySet.shares.map(
    (share) => `trustee-${share.trusteeIndex}-private-share.json`,
  ),
  productionDkgImplemented: false,
}, null, 2));
