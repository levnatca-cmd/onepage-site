import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes, X509Certificate } from "node:crypto";
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { isIP } from "node:net";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { parse } from "parse5";

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} before starting the PQC server.`);
  return value;
}

function configPath(value, label) {
  if (!isAbsolute(value) || /["\\\x00-\x1f$]/.test(value)) {
    throw new Error(`${label} must be an absolute path without nginx metacharacters.`);
  }
  return value;
}

function httpsOrigin(value) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(url.hostname)
  ) {
    throw new Error("PQC_PUBLIC_ORIGIN must be a canonical HTTPS origin with a DNS hostname.");
  }
  return url;
}

function listenAddress(value) {
  const match = /^(\[[a-fA-F0-9:]+\]|[0-9.]+):([0-9]+)$/.exec(value);
  if (!match || !isIP(match[1].replace(/^\[|\]$/g, ""))) {
    throw new Error("PQC_HTTPS_LISTEN must be a literal IP address with a port.");
  }
  const port = Number(match[2]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("The HTTPS listen port must be between 1 and 65535.");
  }
  return value;
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed with status ${result.status}.`);
}

function inlineHashes(root) {
  const hashes = { script: new Set(), style: new Set() };

  function visit(node) {
    if (
      (node.tagName === "style" || node.tagName === "script") &&
      !node.attrs.some(({ name }) => name === "src")
    ) {
      const source = node.childNodes.map(({ value }) => value).join("");
      const digest = createHash("sha256").update(source).digest("base64");
      hashes[node.tagName].add(`'sha256-${digest}'`);
    }
    for (const child of node.childNodes ?? []) visit(child);
  }

  function scan(directory) {
    for (const item of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, item.name);
      if (item.isSymbolicLink()) throw new Error("The public bundle must not contain symlinks.");
      if (item.isDirectory()) scan(path);
      if (item.isFile() && item.name.endsWith(".html")) {
        visit(parse(readFileSync(path, "utf8"), { scriptingEnabled: false }));
      }
    }
  }
  scan(root);
  return hashes;
}

function contentSecurityPolicy(root) {
  const hashes = inlineHashes(root);
  return [
    "default-src 'self'",
    `script-src 'self' ${[...hashes.script].sort().join(" ")}`.trim(),
    "script-src-attr 'none'",
    `style-src 'self' ${[...hashes.style].sort().join(" ")}`.trim(),
    "style-src-attr 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: blob:",
    "media-src 'self' data: blob:",
    "connect-src 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'none'",
  ].join("; ");
}

function localCredentials(runDir, openssl) {
  const cert = join(runDir, "local-cert.pem");
  const key = join(runDir, "local-cert-key.pem");
  const intakeKey = join(runDir, "local-intake-key");
  const signingKey = join(runDir, "local-intake-signing.pem");
  const intakeDir = join(runDir, "intake");
  const socket = join(runDir, "intake.sock");
  mkdirSync(intakeDir, { mode: 0o700 });
  writeFileSync(intakeKey, randomBytes(32), { mode: 0o600, flag: "wx" });
  run(openssl, [
    "req",
    "-new",
    "-x509",
    "-newkey",
    "ec",
    "-pkeyopt",
    "ec_paramgen_curve:P-384",
    "-sha384",
    "-noenc",
    "-days",
    "1",
    "-subj",
    "/CN=localhost",
    "-addext",
    "subjectAltName=DNS:localhost",
    "-addext",
    "basicConstraints=critical,CA:FALSE",
    "-addext",
    "keyUsage=critical,digitalSignature",
    "-addext",
    "extendedKeyUsage=serverAuth",
    "-keyout",
    key,
    "-out",
    cert,
  ]);
  run(openssl, ["genpkey", "-algorithm", "ML-DSA-87", "-out", signingKey]);
  return { cert, key, intakeKey, signingKey, intakeDir, socket };
}

async function main() {
  const flag = process.argv[2];
  const local = flag === "--local";
  const check = flag === "--check";
  if (process.argv.length > 3 || (flag && !local && !check)) {
    throw new Error("Usage: node deploy/pqc/serve.mjs [--local | --check]");
  }

  process.umask(0o077);
  const webRoot = configPath(realpathSync(required("PQC_WEB_ROOT")), "PQC_WEB_ROOT");
  for (const name of ["index.html", "explore.html", "starworld.html", "contact/index.html"]) {
    if (!lstatSync(join(webRoot, name)).isFile()) throw new Error(`Missing public file ${name}.`);
  }
  for (const name of [".git", "src/server", "node_modules"]) {
    if (lstatSync(join(webRoot, name), { throwIfNoEntry: false })) {
      throw new Error("PQC_WEB_ROOT must point to the isolated public bundle.");
    }
  }

  const csp = contentSecurityPolicy(webRoot);
  const nginx = process.env.PQC_NGINX_BIN || "nginx";
  const openssl = process.env.PQC_OPENSSL || "openssl";
  const port = process.env.PQC_STAGE_PORT || "8443";
  const listen = listenAddress(local ? `127.0.0.1:${port}` : required("PQC_HTTPS_LISTEN"));
  const origin = httpsOrigin(local ? `https://localhost:${port}` : required("PQC_PUBLIC_ORIGIN"));
  const aliasName = process.env.PQC_HTTPS_ALIAS;
  const alias = aliasName
    ? httpsOrigin(`https://${aliasName}${origin.port ? `:${origin.port}` : ""}`)
    : null;
  if (alias && (local || aliasName !== alias.hostname || alias.hostname === origin.hostname)) {
    throw new Error(
      "PQC_HTTPS_ALIAS must be a distinct lowercase DNS hostname on the deployed server.",
    );
  }
  const runDir = configPath(mkdtempSync(join(tmpdir(), "pqc-")), "Temporary runtime directory");
  const active = [];
  let interrupted = false;
  const stop = () => {
    interrupted = true;
    for (const { child } of active) {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
    }
  };
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, stop);

  function start(command, args, options = {}) {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    const done = new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code, signal) => resolve({ code, signal }));
    });
    done.catch(() => {});
    const process = { child, done };
    active.push(process);
    return process;
  }

  try {
    const credentials = local
      ? localCredentials(runDir, openssl)
      : {
          cert: configPath(required("PQC_TLS_CERT_FILE"), "PQC_TLS_CERT_FILE"),
          key: configPath(required("PQC_TLS_KEY_FILE"), "PQC_TLS_KEY_FILE"),
          socket: configPath(required("PQC_INQUIRY_SOCKET"), "PQC_INQUIRY_SOCKET"),
        };
    if (local) {
      const intake = start(
        process.execPath,
        [fileURLToPath(new URL("../../src/server/inquiries.mjs", import.meta.url))],
        {
          env: {
            ...process.env,
            PQC_PUBLIC_ORIGIN: origin.origin,
            PQC_INQUIRY_SOCKET: credentials.socket,
            PQC_INQUIRY_DIR: credentials.intakeDir,
            PQC_INQUIRY_KEY_FILE: credentials.intakeKey,
            PQC_INQUIRY_SIGNING_KEY_FILE: credentials.signingKey,
            PQC_INQUIRY_SOCKET_MODE: "0600",
          },
        },
      );
      const ready = (async () => {
        for (let attempt = 0; attempt < 100; attempt += 1) {
          if (lstatSync(credentials.socket, { throwIfNoEntry: false })?.isSocket()) return;
          await delay(50);
        }
        throw new Error("The staging inquiry socket did not become ready.");
      })();
      await Promise.race([
        ready,
        intake.done.then(() => {
          throw new Error("The staging inquiry server exited before creating its socket.");
        }),
      ]);
    }
    if (!lstatSync(credentials.socket).isSocket())
      throw new Error("Inquiry upstream must be a Unix socket.");

    const certificate = new X509Certificate(readFileSync(credentials.cert));
    if (
      !certificate.checkHost(origin.hostname, { subject: "never" }) ||
      (alias && !certificate.checkHost(alias.hostname, { subject: "never" })) ||
      Date.parse(certificate.validFrom) > Date.now() ||
      Date.parse(certificate.validTo) <= Date.now()
    ) {
      throw new Error(
        "The TLS certificate must be valid and cover every configured hostname in its SAN.",
      );
    }
    const settings = {
      RUN_DIR: runDir,
      HTTPS_LISTEN: listen,
      PUBLIC_HOST: origin.hostname,
      PUBLIC_AUTHORITY: origin.host,
      CERT_FILE: credentials.cert,
      KEY_FILE: credentials.key,
      WEB_ROOT: webRoot,
      INQUIRY_SOCKET: credentials.socket,
      CSP: csp,
      HSTS: local ? "" : 'add_header Strict-Transport-Security "max-age=31536000" always;',
      HTTPS_ALIAS_SERVER: alias
        ? `
        server {
            listen ${listen} ssl;
            http2 on;
            server_name ${alias.hostname};
            ssl_certificate "${credentials.cert}";
            ssl_certificate_key "${credentials.key}";
            add_header Strict-Transport-Security "max-age=31536000" always;
            add_header Referrer-Policy no-referrer always;
            if ($ssl_server_name != "${alias.hostname}") { return 421; }
            if ($http_host != "${alias.host}") { return 421; }
              if ($strict_pqc = 0) { return 403; }
            if ($request_method !~ "^(GET|HEAD)$") { return 405; }
            return 308 ${origin.origin}$request_uri;
        }`
        : "",
    };
    const template = readFileSync(new URL("./nginx.conf.template", import.meta.url), "utf8");
    const config = join(runDir, "nginx.conf");
    writeFileSync(
      config,
      template.replace(/@@([A-Z_]+)@@/g, (_, name) => settings[name]),
      {
        mode: 0o600,
        flag: "wx",
      },
    );
    const args = ["-p", `${runDir}/`, "-c", config, "-e", "stderr", "-g", "daemon off;"];
    run(nginx, ["-t", ...args]);
    if (check || interrupted) return;

    start(nginx, args);
    console.log(`PQC site: ${origin.origin}`);
    if (local) {
      const spki = certificate.publicKey.export({ type: "spki", format: "der" });
      console.log(`Test certificate: ${credentials.cert}`);
      console.log(
        `Test certificate SPKI SHA-256: ${createHash("sha256").update(spki).digest("base64")}`,
      );
    }
    const result = await Promise.race(active.map(({ done }) => done));
    if (!interrupted)
      throw new Error(`A PQC server process exited (${result.signal || result.code}).`);
  } finally {
    stop();
    const cleanupTimeout = setTimeout(() => {
      for (const { child } of active) {
        if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
      }
    }, 3000);
    await Promise.allSettled(active.map(({ done }) => done));
    clearTimeout(cleanupTimeout);
    rmSync(runDir, { recursive: true, force: true });
    for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.off(signal, stop);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
