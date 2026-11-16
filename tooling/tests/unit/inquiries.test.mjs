import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { startInquiryServer } from "../../../website/src/server/inquiries.mjs";
import { openInquiryStore } from "../../../website/src/server/inquiry-store.mjs";

const run = promisify(execFile);
const origin = "https://inquiry.example.test";
const inquiry = {
  name: "Synthetic Applicant",
  email: "synthetic@example.test",
  service: "security",
  description: "I would like a review of an example product.\nSynthetic test text.",
  budget: "",
  timeline: "",
};
let directory;
let env;
let server;

before(async () => {
  directory = await mkdtemp(join(tmpdir(), "pqc-"));
  const openssl = process.env.PQC_OPENSSL || "openssl";
  env = {
    PQC_PUBLIC_ORIGIN: origin,
    PQC_INQUIRY_SOCKET: join(directory, "s"),
    PQC_INQUIRY_DIR: join(directory, "records"),
    PQC_INQUIRY_KEY_FILE: join(directory, "enc"),
    PQC_INQUIRY_SIGNING_KEY_FILE: join(directory, "sig.pem"),
    PQC_INQUIRY_VERIFY_KEY_FILE: join(directory, "verify.pem"),
    ...(process.env.PQC_OPENSSL ? { PQC_OPENSSL: process.env.PQC_OPENSSL } : {}),
  };
  await writeFile(env.PQC_INQUIRY_KEY_FILE, randomBytes(32), { mode: 0o600 });
  await run(openssl, [
    "genpkey",
    "-algorithm",
    "ML-DSA-87",
    "-out",
    env.PQC_INQUIRY_SIGNING_KEY_FILE,
  ]);
  await chmod(env.PQC_INQUIRY_SIGNING_KEY_FILE, 0o600);
  const publicKey = await run(openssl, [
    "pkey",
    "-in",
    env.PQC_INQUIRY_SIGNING_KEY_FILE,
    "-pubout",
  ]);
  await writeFile(env.PQC_INQUIRY_VERIFY_KEY_FILE, publicKey.stdout);
  server = await startInquiryServer(env);
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (directory) await rm(directory, { recursive: true, force: true });
});

function post({
  id = randomUUID(),
  body = JSON.stringify(inquiry),
  headers = {},
  method = "POST",
  path = "/api/inquiries",
  chunked = false,
} = {}) {
  const bytes = Buffer.from(body);
  return new Promise((resolve, reject) => {
    const outgoing = request(
      {
        socketPath: env.PQC_INQUIRY_SOCKET,
        path,
        method,
        headers: {
          host: new URL(origin).host,
          origin,
          "sec-fetch-site": "same-origin",
          "content-type": "application/json",
          "idempotency-key": id,
          ...(chunked ? {} : { "content-length": bytes.length }),
          ...headers,
        },
      },
      (incoming) => {
        const result = [];
        incoming.on("data", (chunk) => result.push(chunk));
        incoming.on("error", reject);
        incoming.on("end", () => {
          try {
            resolve({
              status: incoming.statusCode,
              headers: incoming.headers,
              body: JSON.parse(Buffer.concat(result)),
            });
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    outgoing.on("error", reject);
    if (chunked) {
      const halfway = Math.floor(bytes.length / 2);
      outgoing.write(bytes.subarray(0, halfway));
      outgoing.end(bytes.subarray(halfway));
    } else outgoing.end(bytes);
  });
}

test("inquiry endpoint rejects cross-origin, wrong routes, invalid media and unbounded payloads", async () => {
  const cases = [
    [403, { headers: { origin: "https://unrelated.example.test" } }],
    [403, { headers: { origin: "" } }],
    [403, { headers: { host: "wrong.example.test" } }],
    [403, { headers: { "sec-fetch-site": "same-site" } }],
    [405, { method: "GET" }],
    [404, { path: "/api/inquiries?email=hidden" }],
    [415, { headers: { "content-type": "text/plain" } }],
    [415, { headers: { "content-encoding": "gzip" } }],
    [400, { id: "not-a-receipt" }],
    [400, { body: "{" }],
    [400, { body: Buffer.from([0xc0, 0xaf]) }],
    [400, { body: JSON.stringify({ ...inquiry, service: "unknown" }) }],
    [400, { body: JSON.stringify({ ...inquiry, unexpected: "value" }) }],
    [400, { body: JSON.stringify({ ...inquiry, email: "malformed" }) }],
    [400, { body: JSON.stringify({ ...inquiry, description: "   short    " }) }],
    [400, { body: JSON.stringify({ ...inquiry, description: "\ud800".repeat(22) }) }],
    [413, { body: "", headers: { "content-length": 16_385 } }],
    [413, { body: " ".repeat(16_385), chunked: true }],
  ];
  for (const [expected, options] of cases) {
    const result = await post(options);
    assert.equal(result.status, expected);
    assert.equal(result.headers["cache-control"], "no-store");
    assert.equal(result.headers["access-control-allow-origin"], undefined);
    assert.deepEqual(Object.keys(result.body), ["error"]);
  }
  assert.deepEqual(await readdir(env.PQC_INQUIRY_DIR), []);
});

test("acceptance is durable, idempotent, encrypted and signed without exposing a reader", async () => {
  const id = randomUUID();
  const calls = await Promise.all([post({ id }), post({ id })]);
  for (const result of calls) {
    assert.equal(result.status, 201);
    assert.deepEqual(result.body, { id });
    assert.equal(result.headers["cache-control"], "no-store");
  }
  const file = join(env.PQC_INQUIRY_DIR, `${id}.json`);
  assert.deepEqual(await readdir(env.PQC_INQUIRY_DIR), [`${id}.json`]);
  assert.equal((await stat(file)).mode & 0o777, 0o600);
  assert.equal((await stat(env.PQC_INQUIRY_DIR)).mode & 0o777, 0o700);
  assert.equal((await stat(env.PQC_INQUIRY_SOCKET)).mode & 0o777, 0o600);
  const contents = await readFile(file, "utf8");
  assert.ok(!contents.includes(inquiry.email));
  assert.ok(!contents.includes(inquiry.description));
  const envelope = JSON.parse(contents);
  const payload = Buffer.from(envelope.payload, "base64url");
  assert.ok(!payload.includes(inquiry.email));
  assert.ok(!payload.includes(inquiry.description));
  assert.equal(Buffer.from(envelope.signature, "base64url").length, 4627);

  assert.equal(
    (await post({ id, body: JSON.stringify({ ...inquiry, name: "Different applicant" }) })).status,
    409,
  );
  assert.equal((await post({ path: `/api/inquiries/${id}`, method: "GET" })).status, 404);

  await new Promise((resolve) => server.close(resolve));
  server = await startInquiryServer(env);
  assert.deepEqual((await post({ id })).body, { id });
  assert.equal(await readFile(file, "utf8"), contents);

  const reader = await openInquiryStore(env, true);
  const record = await reader.read(id);
  assert.deepEqual(record.inquiry, inquiry);
  assert.equal(record.id, id);
  assert.ok(Number.isFinite(Date.parse(record.receivedAt)));
  const { stdout } = await run(
    process.execPath,
    [
      fileURLToPath(new URL("../../../website/src/server/inquiries.mjs", import.meta.url)),
      "read",
      id,
    ],
    { env: { ...process.env, ...env } },
  );
  assert.deepEqual(JSON.parse(stdout), record);

  const signature = Buffer.from(envelope.signature, "base64url");
  signature[0] ^= 1;
  await writeFile(
    file,
    JSON.stringify({ ...envelope, signature: signature.toString("base64url") }),
  );
  await assert.rejects(reader.read(id), /ML-DSA/);
  assert.equal((await post({ id })).status, 503);
  await writeFile(file, contents);

  const wrongKey = join(directory, "other-encryption-key");
  await writeFile(wrongKey, randomBytes(32), { mode: 0o600 });
  const wrongReader = await openInquiryStore({ ...env, PQC_INQUIRY_KEY_FILE: wrongKey }, true);
  await assert.rejects(wrongReader.read(id), /authenticate|unable/i);
});

test("key or socket configuration fails closed", async () => {
  await assert.rejects(
    startInquiryServer({ ...env, PQC_PUBLIC_ORIGIN: "http://example.test" }),
    /HTTPS/,
  );
  const publicDirectory = join(directory, "public-socket");
  await mkdir(publicDirectory, { mode: 0o755 });
  await assert.rejects(
    startInquiryServer({ ...env, PQC_INQUIRY_SOCKET: join(publicDirectory, "s") }),
    /private directory/,
  );
  const weakKey = join(directory, "weak-permissions");
  await writeFile(weakKey, randomBytes(32), { mode: 0o644 });
  await chmod(weakKey, 0o644);
  await assert.rejects(openInquiryStore({ ...env, PQC_INQUIRY_KEY_FILE: weakKey }), /permissions/);
});

test("maximum Unicode fields fit the request and record bounds", async () => {
  const id = randomUUID();
  const large = {
    ...inquiry,
    name: "\u754c".repeat(120),
    description: "\u754c".repeat(4000),
    budget: "\u754c".repeat(120),
    timeline: "\u754c".repeat(120),
  };
  const result = await post({ id, body: JSON.stringify(large) });
  assert.equal(result.status, 201);
  const reader = await openInquiryStore(env, true);
  assert.deepEqual((await reader.read(id)).inquiry, large);
});

test("sustained requests are limited before touching storage", async () => {
  let limited;
  for (let i = 0; i <= 60 && !limited; i++) {
    const result = await post({ body: "{}" });
    if (result.status === 429) limited = result;
    else assert.equal(result.status, 400);
  }
  assert.equal(limited?.status, 429);
  assert.equal(limited.headers["retry-after"], "60");
  assert.equal((await readdir(env.PQC_INQUIRY_DIR)).length, 2);
});
