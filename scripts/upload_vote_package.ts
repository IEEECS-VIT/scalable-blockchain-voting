import { basename } from "node:path";
import { readFile } from "node:fs/promises";

import {
  digestVotePackage,
  parseVotePackageJson,
  serializeVotePackage,
} from "../packages/crypto/src/index.js";

type IpfsAddResponse = {
  Name?: string;
  Hash: string;
  Size?: string;
};

const DEFAULT_IPFS_API_URL = "http://127.0.0.1:5001";

function usage(): never {
  throw new Error(
    "Usage: npm run upload:vote-package -- <vote-package.json>",
  );
}

function buildIpfsAddUrl(apiBaseUrl: string): URL {
  const endpoint = new URL("/api/v0/add", apiBaseUrl);
  endpoint.searchParams.set("cid-version", "1");
  endpoint.searchParams.set("hash", "sha2-256");
  endpoint.searchParams.set("pin", "true");
  return endpoint;
}

function parseIpfsAddResponse(body: string): IpfsAddResponse {
  const lastJsonLine = body
    .trim()
    .split("\n")
    .filter(Boolean)
    .at(-1);
  if (lastJsonLine === undefined) {
    throw new Error("IPFS add response was empty");
  }

  const parsed = JSON.parse(lastJsonLine) as Partial<IpfsAddResponse>;
  if (typeof parsed.Hash !== "string" || parsed.Hash.length === 0) {
    throw new Error("IPFS add response did not include a CID Hash");
  }

  return parsed as IpfsAddResponse;
}

async function main() {
  const inputPath = process.argv[2] ?? usage();
  const rawJson = await readFile(inputPath, "utf8");
  const votePackage = parseVotePackageJson(rawJson);
  const canonicalJson = serializeVotePackage(votePackage);
  const votePackageDigest = digestVotePackage(votePackage);

  const form = new FormData();
  form.append(
    "file",
    new Blob([canonicalJson], { type: "application/json" }),
    basename(inputPath),
  );

  const headers: Record<string, string> = {};
  const authHeader = process.env.IPFS_API_AUTH_HEADER;
  if (authHeader !== undefined && authHeader.trim().length > 0) {
    headers.authorization = authHeader;
  }

  const response = await fetch(
    buildIpfsAddUrl(process.env.IPFS_API_URL ?? DEFAULT_IPFS_API_URL),
    {
      method: "POST",
      headers,
      body: form,
    },
  );
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`IPFS upload failed: ${response.status} ${body}`);
  }

  const uploaded = parseIpfsAddResponse(body);
  const contentId = `ipfs://${uploaded.Hash}`;

  console.log(JSON.stringify({
    contentId,
    cid: uploaded.Hash,
    name: uploaded.Name ?? basename(inputPath),
    size: uploaded.Size,
    votePackageDigest,
  }, null, 2));
}

await main();
