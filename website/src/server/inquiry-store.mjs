import { execFile } from "node:child_process";
import { createCipheriv, createDecipheriv, createSecretKey, randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, mkdir, mkdtemp, open, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

const signatureBytes = 4627;
const maxEnvelopeBytes = 32 * 1024;
const recordVersion = 1;
const dataFileMode = 0o600;

export const receiptPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function absoluteSetting(env, name) {
  const value = env[name];
  if (!value || !isAbsolute(value)) throw new Error(`${name} must be an absolute path.`);
  return value;
}

async function readFileChecked(path, maxBytes, privateFile = true) {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = await file.stat();
    if (
      !stat.isFile() ||
      stat.size < 1 ||
      stat.size > maxBytes ||
      (privateFile && (stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0))
    )
      throw new Error("Invalid inquiry file type, owner, size, or permissions.");
    const bytes = await file.readFile();
    if (bytes.length !== stat.size) throw new Error("Inquiry file changed during read.");
    return bytes;
  } finally {
    await file.close();
  }
}

function openSSL(executable, args, input) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      executable,
      args,
      { encoding: "buffer", maxBuffer: 24 * 1024, timeout: 5000, killSignal: "SIGKILL" },
      (error, stdout) => {
        if (error) reject(new Error("OpenSSL could not complete the ML-DSA operation."));
        else resolve(stdout);
      },
    );
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
}

async function checkSigningAlgorithm(executable, publicKey) {
  const description = await openSSL(
    executable,
    ["pkey", "-pubin", "-text_pub", "-noout"],
    publicKey,
  );
  if (!description.toString("utf8").startsWith("ML-DSA-87 Public-Key:"))
    throw new Error("The inquiry signing key must be ML-DSA-87.");
}

function authenticatedContext(id) {
  return Buffer.from(`LEVNAT inquiry v${recordVersion}\n${id}`, "utf8");
}

function encrypt(key, id, inquiry) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
  cipher.setAAD(authenticatedContext(id));
  const plaintext = Buffer.from(
    JSON.stringify({ receivedAt: new Date().toISOString(), inquiry }),
    "utf8",
  );
  try {
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return Buffer.from(
      JSON.stringify({
        version: recordVersion,
        id,
        iv: iv.toString("base64url"),
        tag: cipher.getAuthTag().toString("base64url"),
        ciphertext: ciphertext.toString("base64url"),
      }),
      "utf8",
    );
  } finally {
    plaintext.fill(0);
  }
}

function decrypt(key, id, payload) {
  const sealed = JSON.parse(payload);
  if (sealed.version !== recordVersion || sealed.id !== id)
    throw new Error("Inquiry envelope identity mismatch.");
  const iv = Buffer.from(sealed.iv, "base64url");
  const tag = Buffer.from(sealed.tag, "base64url");
  if (iv.length !== 12 || tag.length !== 16)
    throw new Error("Invalid inquiry encryption envelope.");
  const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
  decipher.setAAD(authenticatedContext(id));
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(sealed.ciphertext, "base64url")),
    decipher.final(),
  ]);
  try {
    return JSON.parse(plaintext);
  } finally {
    plaintext.fill(0);
  }
}

async function withScratch(directory, action) {
  const scratch = await mkdtemp(join(directory, ".inquiry-"));
  try {
    return await action(scratch);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

async function syncDirectory(directory) {
  const handle = await open(directory, constants.O_RDONLY | constants.O_DIRECTORY);
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function openInquiryStore(env, readOnly = false) {
  const directory = absoluteSetting(env, "PQC_INQUIRY_DIR");
  if (!readOnly)
    await mkdir(directory, { mode: 0o700 }).catch((error) => {
      if (error.code !== "EEXIST") throw error;
    });
  const stat = await lstat(directory);
  if (!stat.isDirectory() || stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0)
    throw new Error("PQC_INQUIRY_DIR must be a private directory owned by the current user.");

  const rawKey = await readFileChecked(absoluteSetting(env, "PQC_INQUIRY_KEY_FILE"), 32);
  if (rawKey.length !== 32)
    throw new Error("The inquiry encryption key must contain 32 raw bytes.");
  const encryptionKey = createSecretKey(rawKey);
  rawKey.fill(0);

  const executable = env.PQC_OPENSSL ? absoluteSetting(env, "PQC_OPENSSL") : "openssl";
  const signingKey = readOnly
    ? null
    : await readFileChecked(absoluteSetting(env, "PQC_INQUIRY_SIGNING_KEY_FILE"), 24 * 1024);
  const publicKey = readOnly
    ? await readFileChecked(absoluteSetting(env, "PQC_INQUIRY_VERIFY_KEY_FILE"), 24 * 1024, false)
    : await openSSL(executable, ["pkey", "-passin", "pass:", "-pubout"], signingKey);
  await checkSigningAlgorithm(executable, publicKey);

  async function signPayload(scratch, payload) {
    const inputPath = join(scratch, "payload");
    await writeFile(inputPath, payload, { flag: "wx", mode: dataFileMode });
    const signature = await openSSL(
      executable,
      ["pkeyutl", "-sign", "-rawin", "-inkey", "/dev/stdin", "-passin", "pass:", "-in", inputPath],
      signingKey,
    );
    if (signature.length !== signatureBytes) throw new Error("Unexpected ML-DSA signature size.");
    return signature;
  }

  async function verifyPayload(payload, signature) {
    if (signature.length !== signatureBytes) throw new Error("Invalid ML-DSA signature size.");
    await withScratch(directory, async (scratch) => {
      const inputPath = join(scratch, "payload");
      const sigPath = join(scratch, "signature");
      await Promise.all([
        writeFile(inputPath, payload, { flag: "wx", mode: dataFileMode }),
        writeFile(sigPath, signature, { flag: "wx", mode: dataFileMode }),
      ]);
      await openSSL(
        executable,
        [
          "pkeyutl",
          "-verify",
          "-rawin",
          "-pubin",
          "-inkey",
          "/dev/stdin",
          "-in",
          inputPath,
          "-sigfile",
          sigPath,
        ],
        publicKey,
      );
    });
  }

  if (!readOnly) {
    const probe = Buffer.from("LEVNAT inquiry signing self-test v1");
    const proof = await withScratch(directory, (scratch) => signPayload(scratch, probe));
    await verifyPayload(probe, proof);
    await syncDirectory(directory);
  }

  function recordPath(id) {
    if (!receiptPattern.test(id)) throw new Error("Invalid inquiry receipt.");
    return join(directory, `${id}.json`);
  }

  async function read(id) {
    const envelope = JSON.parse(await readFileChecked(recordPath(id), maxEnvelopeBytes));
    const payload = Buffer.from(envelope.payload, "base64url");
    const signature = Buffer.from(envelope.signature, "base64url");
    await verifyPayload(payload, signature);
    return { id, ...decrypt(encryptionKey, id, payload) };
  }

  async function put(id, inquiry) {
    if (readOnly) throw new Error("The inquiry reader cannot write records.");
    const destination = recordPath(id);
    const existing = await read(id).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (existing) {
      await syncDirectory(directory);
      return JSON.stringify(existing.inquiry) === JSON.stringify(inquiry);
    }

    const created = await withScratch(directory, async (scratch) => {
      const payload = encrypt(encryptionKey, id, inquiry);
      const signature = await signPayload(scratch, payload);
      const contents = JSON.stringify({
        payload: payload.toString("base64url"),
        signature: signature.toString("base64url"),
      });
      if (Buffer.byteLength(contents) > maxEnvelopeBytes)
        throw new Error("Inquiry envelope exceeds its storage limit.");
      const pending = join(scratch, "record");
      const file = await open(pending, "wx", dataFileMode);
      try {
        await file.writeFile(contents);
        await file.sync();
      } finally {
        await file.close();
      }
      try {
        await link(pending, destination);
      } catch (error) {
        if (error.code === "EEXIST") return false;
        throw error;
      }
      await syncDirectory(directory);
      return true;
    });
    if (created) return true;

    // A concurrent request can commit the receipt first. Keep the first record.
    const winner = await read(id);
    await syncDirectory(directory);
    return JSON.stringify(winner.inquiry) === JSON.stringify(inquiry);
  }

  return { put, read };
}
