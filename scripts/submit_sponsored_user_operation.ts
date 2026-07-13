import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  validateSponsoredUserOperationRequest,
  type SponsoredUserOperationRequest,
} from "../packages/crypto/src/sponsoredUserOperation.js";

const inputPath = process.argv[2];
if (inputPath === undefined) {
  throw new Error(
    "usage: npm run submit:userop -- sponsored-user-operation.json [evidence.json] [--send]",
  );
}
const outputArgument = process.argv.slice(3).find((argument) => argument !== "--send");
const outputPath = path.resolve(
  outputArgument ??
    path.join(path.dirname(inputPath), "sponsored-user-operation-evidence.json"),
);
const bundlerUrl = process.env.BUNDLER_RPC_URL;
if (bundlerUrl === undefined || bundlerUrl.trim() === "") {
  throw new Error("BUNDLER_RPC_URL is required");
}
const request = validateSponsoredUserOperationRequest(
  JSON.parse(await readFile(path.resolve(inputPath), "utf8")) as SponsoredUserOperationRequest,
);

let requestId = 0;
async function rpc(method: string, params: readonly unknown[]) {
  const response = await fetch(bundlerUrl!, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method, params }),
  });
  if (!response.ok) throw new Error(`bundler HTTP ${response.status}`);
  const payload = await response.json() as {
    result?: unknown;
    error?: { code: number; message: string; data?: unknown };
  };
  if (payload.error !== undefined) {
    throw new Error(`${method} failed: ${payload.error.message}`);
  }
  return payload.result;
}

const supportedEntryPoints = await rpc("eth_supportedEntryPoints", []);
if (
  !Array.isArray(supportedEntryPoints) ||
  !supportedEntryPoints.some(
    (entryPoint) =>
      typeof entryPoint === "string" &&
      entryPoint.toLowerCase() === request.entryPoint.toLowerCase(),
  )
) {
  throw new Error("bundler does not support the requested EntryPoint");
}
const gasEstimate = await rpc("eth_estimateUserOperationGas", [
  request.userOperation,
  request.entryPoint,
]);
if (!process.argv.includes("--send")) {
  const artifact = {
    mode: "bundler-dry-run",
    mock: false,
    sent: false,
    entryPoint: request.entryPoint,
    supportedEntryPoints,
    gasEstimate,
    sponsored: true,
  };
  await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(JSON.stringify({ outputPath, ...artifact }, null, 2));
  process.exit(0);
}

const userOperationHash = await rpc("eth_sendUserOperation", [
  request.userOperation,
  request.entryPoint,
]);
let receipt: unknown;
for (let attempt = 0; attempt < 30; attempt += 1) {
  receipt = await rpc("eth_getUserOperationReceipt", [userOperationHash]);
  if (receipt !== null && receipt !== undefined) break;
  await new Promise((resolve) => setTimeout(resolve, 2_000));
}
if (receipt === null || receipt === undefined) {
  throw new Error("UserOperation receipt was not available after 60 seconds");
}
const artifact = {
  mock: false,
  entryPoint: request.entryPoint,
  paymasterAddress:
    request.userOperation.paymaster ??
    request.userOperation.paymasterAndData?.slice(0, 42),
  userOperationHash,
  receipt,
  gasEstimate,
};
await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, ...artifact }, null, 2));
