import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const port = Number(process.env.DEMO_PORT ?? "8080");
const frontendRoot = path.resolve("frontend/demo");
const artifactRoot = path.resolve(process.argv[2] ?? "demo-output-v2");

if (!process.argv.includes("--no-generate")) {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/generate_complete_demo_v2.ts", artifactRoot],
    { cwd: process.cwd(), encoding: "utf8", stdio: "inherit" },
  );
  if (result.status !== 0) throw new Error("complete demo generation failed");
}

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function safePath(root: string, requestPath: string) {
  const resolved = path.resolve(root, `.${requestPath}`);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("invalid path");
  }
  return resolved;
}

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    let filePath: string;
    if (requestUrl.pathname === "/api/status") {
      filePath = path.join(artifactRoot, "demo-summary.json");
    } else if (requestUrl.pathname.startsWith("/artifacts/")) {
      filePath = safePath(artifactRoot, requestUrl.pathname.slice("/artifacts".length));
    } else {
      const pathname = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
      filePath = safePath(frontendRoot, pathname);
    }
    if ((await stat(filePath)).isDirectory()) filePath = path.join(filePath, "index.html");
    const body = await readFile(filePath);
    response.writeHead(200, {
      "content-type": contentTypes[path.extname(filePath)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    response.end(body);
  } catch {
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not found" }));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Complete voting demo: http://127.0.0.1:${port}`);
  console.log(`Artifacts: ${artifactRoot}`);
});
