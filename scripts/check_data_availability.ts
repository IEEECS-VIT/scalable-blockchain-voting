import { dirname, resolve } from "node:path";
import { readFile } from "node:fs/promises";

import {
  digestVotePackage,
  parseVotePackageJson,
  serializeVotePackage,
  type Bytes32,
} from "../packages/crypto/src/index.js";

type DataAvailabilityInputPackage = {
  contentId: string;
  path: string;
  expectedDigest?: Bytes32;
};

type DataAvailabilityInput = {
  electionId: Bytes32;
  packages: readonly DataAvailabilityInputPackage[];
};

type DataAvailabilityResult = {
  contentId: string;
  path: string;
  ok: boolean;
  digest?: Bytes32;
  canonicalBytes?: number;
  fetchedBytes?: number;
  error?: string;
};

function usage(): never {
  throw new Error(
    "Usage: npm run check:data -- <batch-input.json>",
  );
}

function cidFromContentId(contentId: string): string {
  if (!contentId.startsWith("ipfs://") || contentId.length <= "ipfs://".length) {
    throw new Error(`invalid IPFS content ID: ${contentId}`);
  }
  return contentId.slice("ipfs://".length);
}

function ipfsGatewayUrl(contentId: string): URL {
  const gatewayBaseUrl = process.env.IPFS_GATEWAY_URL ?? "https://ipfs.io/ipfs/";
  return new URL(
    cidFromContentId(contentId),
    gatewayBaseUrl.endsWith("/") ? gatewayBaseUrl : `${gatewayBaseUrl}/`,
  );
}

async function maybeFetchIpfsContent(contentId: string): Promise<string | undefined> {
  if (process.env.CHECK_IPFS_FETCH !== "1") {
    return undefined;
  }

  const response = await fetch(ipfsGatewayUrl(contentId));
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`IPFS fetch failed: ${response.status} ${body}`);
  }
  return body;
}

async function checkPackage(
  inputDir: string,
  electionId: Bytes32,
  entry: DataAvailabilityInputPackage,
): Promise<DataAvailabilityResult> {
  try {
    cidFromContentId(entry.contentId);
    const localJson = await readFile(resolve(inputDir, entry.path), "utf8");
    const votePackage = parseVotePackageJson(localJson);
    if (votePackage.electionId !== electionId.toLowerCase()) {
      throw new Error("package electionId does not match batch input");
    }

    const canonicalJson = serializeVotePackage(votePackage);
    const digest = digestVotePackage(votePackage);
    if (entry.expectedDigest !== undefined && entry.expectedDigest.toLowerCase() !== digest) {
      throw new Error("expectedDigest does not match package digest");
    }

    const fetchedJson = await maybeFetchIpfsContent(entry.contentId);
    if (fetchedJson !== undefined) {
      const fetchedPackage = parseVotePackageJson(fetchedJson);
      const fetchedDigest = digestVotePackage(fetchedPackage);
      if (fetchedDigest !== digest) {
        throw new Error("fetched IPFS package digest does not match local package digest");
      }
      return {
        contentId: entry.contentId,
        path: entry.path,
        ok: true,
        digest,
        canonicalBytes: Buffer.byteLength(canonicalJson),
        fetchedBytes: Buffer.byteLength(fetchedJson),
      };
    }

    return {
      contentId: entry.contentId,
      path: entry.path,
      ok: true,
      digest,
      canonicalBytes: Buffer.byteLength(canonicalJson),
    };
  } catch (error) {
    return {
      contentId: entry.contentId,
      path: entry.path,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  const inputPath = process.argv[2] ?? usage();
  const inputJson = await readFile(inputPath, "utf8");
  const input = JSON.parse(inputJson) as DataAvailabilityInput;
  if (!Array.isArray(input.packages) || input.packages.length === 0) {
    throw new Error("data availability input must include at least one package");
  }

  const inputDir = dirname(inputPath);
  const checks = await Promise.all(
    input.packages.map((entry) => checkPackage(inputDir, input.electionId, entry)),
  );
  const failed = checks.filter((check) => !check.ok);

  console.log(JSON.stringify({
    allAvailable: failed.length === 0,
    checkedAt: new Date().toISOString(),
    fetchIpfs: process.env.CHECK_IPFS_FETCH === "1",
    checks,
  }, null, 2));

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

await main();
