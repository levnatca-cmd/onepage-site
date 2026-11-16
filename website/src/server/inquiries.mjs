import { once } from "node:events";
import { chmod, lstat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { SERVICE_LABELS } from "../studio/inquiry.js";
import { absoluteSetting, openInquiryStore, receiptPattern } from "./inquiry-store.mjs";

const bodyLimit = 16 * 1024;
const rateWindow = 60_000;
const maxRequestsPerWindow = 60;
const maxActiveRequests = 8;
const fieldLimits = { name: 120, email: 254, description: 4000, budget: 120, timeline: 120 };
const fields = new Set(["service", ...Object.keys(fieldLimits)]);
const required = new Set(["email", "description"]);
const singleLineControls = /[\x00-\x1f\x7f-\x9f]/u;
const descriptionControls = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/u;
const emailAddress =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/;

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function validateInquiry(value) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !fields.has(key)) ||
    typeof value.service !== "string" ||
    !Object.hasOwn(SERVICE_LABELS, value.service)
  )
    throw new RequestError(400, "Invalid inquiry fields.");

  const inquiry = { service: value.service };
  for (const [key, limit] of Object.entries(fieldLimits)) {
    const text = !Object.hasOwn(value, key) && !required.has(key) ? "" : value[key];
    const controls = key === "description" ? descriptionControls : singleLineControls;
    if (
      typeof text !== "string" ||
      text.length > limit ||
      !text.isWellFormed() ||
      controls.test(text)
    )
      throw new RequestError(400, "Invalid inquiry field format or length.");
    inquiry[key] = text.trim();
  }
  if (!emailAddress.test(inquiry.email) || inquiry.description.length < 20)
    throw new RequestError(
      400,
      "Provide a valid email and a description of at least 20 characters.",
    );
  return inquiry;
}

async function readBody(request) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    totalBytes += chunk.length;
    if (totalBytes > bodyLimit) throw new RequestError(413, "Inquiry is too large.");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
  } catch {
    throw new RequestError(400, "Inquiry must be valid UTF-8 JSON.");
  }
}

function send(response, status, value) {
  const body = JSON.stringify(value);
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...(status >= 400 ? { Connection: "close" } : {}),
    ...(status === 405 ? { Allow: "POST" } : {}),
    ...(status === 429 ? { "Retry-After": "60" } : {}),
  };
  response.writeHead(status, headers);
  response.end(body);
}

function validateRequest(request, publicOrigin) {
  if (request.url !== "/api/inquiries") throw new RequestError(404, "Unknown endpoint.");
  if (request.method !== "POST") throw new RequestError(405, "Use POST to send an inquiry.");
  if (
    request.headers.host !== publicOrigin.host ||
    request.headers.origin !== publicOrigin.origin ||
    (request.headers["sec-fetch-site"] && request.headers["sec-fetch-site"] !== "same-origin")
  )
    throw new RequestError(403, "Inquiry origin is not allowed.");
  if (
    !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers["content-type"] || "") ||
    (request.headers["content-encoding"] && request.headers["content-encoding"] !== "identity")
  )
    throw new RequestError(415, "Send UTF-8 JSON.");
  if (Number(request.headers["content-length"]) > bodyLimit)
    throw new RequestError(413, "Inquiry is too large.");

  const id = request.headers["idempotency-key"];
  if (typeof id !== "string" || !receiptPattern.test(id))
    throw new RequestError(400, "Provide a valid inquiry idempotency key.");
  return id;
}

export async function startInquiryServer(env = process.env) {
  const publicOrigin = new URL(env.PQC_PUBLIC_ORIGIN || "https://invalid.invalid/");
  if (publicOrigin.protocol !== "https:" || publicOrigin.origin !== env.PQC_PUBLIC_ORIGIN)
    throw new Error(
      "PQC_PUBLIC_ORIGIN must be the exact public HTTPS origin without a trailing slash.",
    );

  const socketPath = absoluteSetting(env, "PQC_INQUIRY_SOCKET");
  const socketMode = env.PQC_INQUIRY_SOCKET_MODE || "0600";
  if (socketMode !== "0600" && socketMode !== "0660")
    throw new Error("PQC_INQUIRY_SOCKET_MODE must be 0600 or 0660.");
  const socketDirectory = await lstat(dirname(socketPath));
  const forbiddenPermissions = socketMode === "0600" ? 0o077 : 0o007;
  if (
    !socketDirectory.isDirectory() ||
    socketDirectory.uid !== process.getuid() ||
    (socketDirectory.mode & forbiddenPermissions) !== 0
  )
    throw new Error(
      "PQC_INQUIRY_SOCKET must be inside a private directory owned by the current user.",
    );

  const store = await openInquiryStore(env);
  const recent = [];
  let active = 0;
  const server = createServer(
    {
      requestTimeout: 10_000,
      headersTimeout: 5_000,
      keepAliveTimeout: 2_000,
      connectionsCheckingInterval: 1_000,
      maxHeaderSize: 8_192,
    },
    async (request, response) => {
      let accepted = false;
      try {
        const id = validateRequest(request, publicOrigin);
        const now = performance.now();
        while (recent.length && recent[0] <= now - rateWindow) recent.shift();
        if (active >= maxActiveRequests || recent.length >= maxRequestsPerWindow)
          throw new RequestError(429, "Inquiry service is busy. Try again shortly.");
        recent.push(now);
        active += 1;
        accepted = true;

        const inquiry = validateInquiry(await readBody(request));
        if (!(await store.put(id, inquiry)))
          throw new RequestError(409, "This inquiry receipt is already in use.");
        send(response, 201, { id });
      } catch (error) {
        if (response.destroyed || response.headersSent) return;
        if (error instanceof RequestError) send(response, error.status, { error: error.message });
        else send(response, 503, { error: "Secure inquiry storage is unavailable. Try again." });
      } finally {
        if (accepted) active -= 1;
      }
    },
  );
  server.maxConnections = 32;
  server.maxRequestsPerSocket = 8;
  server.setTimeout(15_000, (socket) => socket.destroy());

  server.listen(socketPath);
  await once(server, "listening");
  try {
    await chmod(socketPath, Number.parseInt(socketMode, 8));
  } catch (error) {
    server.close();
    throw error;
  }
  return server;
}

async function main() {
  process.umask(0o077);
  const [action, id, ...extra] = process.argv.slice(2);
  if (!action) {
    const server = await startInquiryServer();
    process.once("SIGINT", () => server.close());
    process.once("SIGTERM", () => server.close());
    console.info("Secure inquiry intake ready.");
    return;
  }
  if (action !== "read" || !receiptPattern.test(id || "") || extra.length)
    throw new Error("Usage: node src/server/inquiries.mjs [read <receipt>]");
  const store = await openInquiryStore(process.env, true);
  const record = await store.read(id).catch(() => {
    throw new Error("Inquiry could not be read and verified.");
  });
  // This command is the private operator interface. Its stdout is intentionally sensitive.
  process.stdout.write(JSON.stringify(record, null, 2) + "\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
