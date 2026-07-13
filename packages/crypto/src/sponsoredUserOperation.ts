import assert from "node:assert/strict";

import { isAddress, isHex, type Address, type Hex } from "viem";

export type SponsoredUserOperationRequest = {
  entryPoint: Address;
  userOperation: Record<string, unknown> & {
    sender: Address;
    nonce: Hex;
    callData: Hex;
    signature: Hex;
    paymaster?: Address;
    paymasterAndData?: Hex;
  };
};

export function validateSponsoredUserOperationRequest(
  input: SponsoredUserOperationRequest,
): SponsoredUserOperationRequest {
  assert.equal(isAddress(input.entryPoint), true, "entryPoint is invalid");
  assert.equal(isAddress(input.userOperation.sender), true, "sender is invalid");
  for (const [label, value] of [
    ["nonce", input.userOperation.nonce],
    ["callData", input.userOperation.callData],
    ["signature", input.userOperation.signature],
  ] as const) {
    assert.equal(isHex(value, { strict: true }), true, `${label} is invalid`);
  }
  const hasV07Paymaster =
    input.userOperation.paymaster !== undefined &&
    isAddress(input.userOperation.paymaster) &&
    input.userOperation.paymaster !== "0x0000000000000000000000000000000000000000";
  const hasV06Paymaster =
    input.userOperation.paymasterAndData !== undefined &&
    isHex(input.userOperation.paymasterAndData, { strict: true }) &&
    input.userOperation.paymasterAndData.length > 42;
  assert.equal(
    hasV07Paymaster || hasV06Paymaster,
    true,
    "UserOperation has no non-zero paymaster sponsorship",
  );
  return input;
}
