import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { lstatSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const origin = new URL(process.argv[2]);
assert.equal(origin.protocol, "https:");
assert.equal(origin.href, `${origin.origin}/`, "Supply the HTTPS origin only");
const openssl = process.env.PQC_OPENSSL || "openssl";
const connect = process.env.PQC_CHECK_CONNECT || `${origin.hostname}:${origin.port || "443"}`;
const ca = process.env.PQC_CA_FILE ? ["-CAfile", process.env.PQC_CA_FILE] : [];
const hybrid = ["-tls1_3", "-groups", "X25519MLKEM768"];

function probe(flags, { sni = origin.hostname, input = "" } = {}) {
  const result = spawnSync(
    openssl,
    [
      "s_client",
      "-connect",
      connect,
      "-servername",
      sni,
      "-brief",
      "-verify_hostname",
      origin.hostname,
      "-verify_return_error",
      ...ca,
      ...flags,
    ],
    { input, encoding: "utf8", timeout: 10000 },
  );
  if (result.error) throw result.error;
  return result;
}

function request(path, { method = "HEAD", flags = [] } = {}) {
  const input = `${method} ${path} HTTP/1.1\r\nHost: ${origin.host}\r\nConnection: close\r\n\r\n`;
  const reply = probe([...hybrid, "-ign_eof", ...flags], { input });
  assert.equal(reply.status, 0, reply.stderr);
  assert.match(reply.stderr, /Protocol version: TLSv1\.3/);
  assert.match(reply.stderr, /Negotiated TLS1\.3 group: X25519MLKEM768/);
  assert.match(reply.stderr, /Ciphersuite: TLS_(AES_256_GCM_SHA384|CHACHA20_POLY1305_SHA256)/);
  const headers = reply.stdout.match(/HTTP\/1\.1 (\d{3}) [^\r\n]*\r\n[\s\S]*?\r\n\r\n/);
  assert.ok(headers, `No HTTP response for ${path}`);
  return { status: Number(headers[1]), headers: headers[0] };
}

const scratch = mkdtempSync(join(tmpdir(), "pqc-check-"));
try {
  const session = join(scratch, "session.pem");
  const readiness = request("/api/inquiries/ready", {
    method: "GET",
    flags: ["-sess_out", session],
  });
  assert.equal(readiness.status, 204);
  assert.match(readiness.headers, /^X-Inquiry-Transport: strict-pqc-v1\r$/im);
  assert.match(readiness.headers, /^Cache-Control: no-store\r$/im);

  // OpenSSL can issue a stateful ticket with tickets off. The server must refuse to resume it.
  if (lstatSync(session, { throwIfNoEntry: false })?.size) {
    const repeated = request("/api/inquiries/ready", {
      method: "GET",
      flags: ["-sess_in", session],
    });
    assert.equal(repeated.status, 204, "The handshake must be fresh even if offered a session");
  }
  console.log("TLS 1.3 X25519MLKEM768 verified. Session resumption unavailable.");
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

for (const [name, flags, options] of [
  ["classical X25519", ["-tls1_3", "-groups", "X25519"], {}],
  ["TLS 1.2", ["-tls1_2"], {}],
  ["AES-128-only TLS", [...hybrid, "-ciphersuites", "TLS_AES_128_GCM_SHA256"], {}],
  ["unknown hostname", hybrid, { sni: "unknown.pqc.invalid" }],
]) {
  const refused = probe(flags, options);
  assert.notEqual(refused.status, 0, `${name} unexpectedly negotiated TLS`);
  assert.doesNotMatch(refused.stderr, /CONNECTION ESTABLISHED/);
  assert.match(refused.stderr, /alert handshake failure|alert protocol version|unrecognized name/i);
  console.log(`Refused ${name}.`);
}

for (const path of [
  "/",
  "/home/",
  "/explore.html",
  "/starworld.html",
  "/services/",
  "/contact/",
  "/approach/",
  "/work/",
  "/work/daybook/",
  "/work/daybook/demo/",
  "/services/integrations/",
  "/services/support/",
  "/services/websites-apps/",
  "/services/backend-api/",
  "/services/automation/",
  "/services/post-quantum-security/",
  "/services/data-logs/",
  "/services/hardware/",
  "/services/monitoring/",
]) {
  const reply = request(path);
  assert.equal(reply.status, 200, path);
  const csp = reply.headers.match(/^Content-Security-Policy: ([^\r\n]+)/im)?.[1];
  const scripts = csp
    ?.split(";")
    .find((directive) => directive.trimStart().startsWith("script-src "));
  assert.match(scripts ?? "", /'self'.*'sha256-/);
  assert.doesNotMatch(scripts, /'unsafe-inline'|'unsafe-eval'/);
  console.log(`Protected route ${path}`);
}

for (const path of [
  "/.git/config",
  "/package.json",
  "/deploy/pqc/serve.mjs",
  "/src/server/inquiries.mjs",
]) {
  assert.equal(request(path).status, 404, path);
}
assert.equal(request("/api/inquiries", { method: "GET" }).status, 405);
console.log("Private files are blocked and inquiry submission requires POST.");
