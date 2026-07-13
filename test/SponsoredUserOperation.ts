import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  validateSponsoredUserOperationRequest,
  type SponsoredUserOperationRequest,
} from "../packages/crypto/src/sponsoredUserOperation.js";

const baseRequest: SponsoredUserOperationRequest = {
  entryPoint: "0x0000000071727de22e5e9d8baf0edac6f37da032",
  userOperation: {
    sender: "0x1111111111111111111111111111111111111111",
    nonce: "0x0",
    callData: "0x1234",
    signature: "0xabcd",
    paymaster: "0x2222222222222222222222222222222222222222",
  },
};

describe("sponsored ERC-4337 request validation", function () {
  it("accepts a provider-sponsored UserOperation", function () {
    assert.deepEqual(validateSponsoredUserOperationRequest(baseRequest), baseRequest);
  });

  it("rejects a UserOperation without real paymaster data", function () {
    const request = structuredClone(baseRequest);
    delete request.userOperation.paymaster;
    assert.throws(() => validateSponsoredUserOperationRequest(request));
  });
});
