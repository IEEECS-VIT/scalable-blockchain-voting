import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";

const demoDir = join(process.cwd(), "frontend", "demo");

type DemoManifest = {
  warning: string;
  pages: readonly {
    id: string;
    label: string;
    path: string;
  }[];
};

const requiredPages = [
  "registration",
  "voting",
  "receipt",
  "batch",
  "tally",
  "verification",
] as const;

describe("frontend demo files", function () {
  it("contains every required demo page with visible trust-boundary labels", async function () {
    const manifest = JSON.parse(
      await readFile(join(demoDir, "manifest.json"), "utf8"),
    ) as DemoManifest;

    assert.match(manifest.warning, /placeholder|proof|mock/i);
    assert.deepEqual(
      manifest.pages.map((page) => page.id).sort(),
      [...requiredPages].sort(),
    );

    const indexHtml = await readFile(join(demoDir, "index.html"), "utf8");
    for (const page of manifest.pages) {
      assert.match(indexHtml, new RegExp(page.path.replace(".", "\\.")));
    }
    assert.match(indexHtml, /Honest boundary/i);
    assert.match(indexHtml, /remain (?:separately )?gated/i);

    const interactiveScript = await readFile(
      join(demoDir, "interactive.js"),
      "utf8",
    );
    assert.match(interactiveScript, /retainedBiometricFields:\s*\[\]/);
    assert.match(interactiveScript, /data-ballot-output/);
    assert.match(interactiveScript, /data-run-verification/);

    for (const page of manifest.pages) {
      const html = await readFile(join(demoDir, page.path), "utf8");
      assert.match(html, new RegExp(`${page.label} page`, "i"));
      assert.match(html, /Simulation boundary|Real boundary|Honest boundary|Failure demonstration|Remaining blockers/i);
      assert.match(
        html,
        /placeholder|pending|external integration|not a real|not an Anon Aadhaar|not trustless|not an audited|not a full|mock/i,
      );
      assert.match(html, /Back to overview/);
    }
  });
});
