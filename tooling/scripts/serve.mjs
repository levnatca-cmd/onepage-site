import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname } from "node:path";
import { publicPath } from "./lib/paths.mjs";

const port = Number(process.env.PORT || 4173);
const internalPaths = new Set([
  "agents.md",
  "agent-rules",
  "deploy",
  "node_modules",
  "projects",
  "tests",
  "tooling",
  "website",
]);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".woff2": "font/woff2",
};
const server = createServer((request, response) => {
  let pathname;
  let requestUrl;
  try {
    requestUrl = new URL(request.url, "http://localhost");
    pathname = decodeURIComponent(requestUrl.pathname);
  } catch {
    response.writeHead(400).end("Invalid path");
    return;
  }
  if (/[\\\x00-\x1f\x7f]/.test(pathname)) {
    response.writeHead(400).end("Invalid path");
    return;
  }
  const parts = pathname.toLowerCase().split("/").filter(Boolean);
  const blocked = parts.some((part) => part.startsWith(".") || internalPaths.has(part));
  const route = parts.join("/");
  if (
    blocked ||
    route === "src/galaxy" ||
    route === "src/galaxy/index.html" ||
    (parts[0] === "src" && parts[1] === "server")
  ) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  const file = publicPath(pathname.endsWith("/") ? `${pathname}index.html` : pathname);
  try {
    const stats = statSync(file);
    if (stats.isDirectory() && !pathname.endsWith("/")) {
      response.writeHead(308, { Location: `${requestUrl.pathname}/${requestUrl.search}` }).end();
      return;
    }
    if (!stats.isFile()) throw new Error("Not a file");
    response.writeHead(200, {
      "Content-Type": types[extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    if (request.method === "HEAD") response.end();
    else createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404).end("Not found");
  }
});
server.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () =>
  console.log(`Local: http://127.0.0.1:${port}\nGalaxy: /explore.html`),
);
