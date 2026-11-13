# Strict PQC staging and deployment

NGINX serves the public bundle with TLS 1.3 and the single hybrid group
`X25519MLKEM768`. It allows AES-256-GCM and ChaCha20-Poly1305. Session
resumption and early data are disabled. The request policy also checks the
negotiated group and that the session is fresh. The inquiry endpoint reaches
the private intake process over a Unix socket.

Use a supported, security-patched NGINX build with HTTP SSL, HTTP/2, and
OpenSSL 3.5 or newer. The local acceptance run uses NGINX 1.30.6 and OpenSSL
3.6.1. Install the repository dependencies with `npm ci`. The launcher uses
the staged HTML to calculate its CSP hashes.

## Local staging

```sh
pqc_bundle_parent="$(mktemp -d)"
node scripts/build-pqc.mjs "$pqc_bundle_parent/public"
PQC_WEB_ROOT="$pqc_bundle_parent/public" \
PQC_NGINX_BIN=/absolute/path/to/nginx \
node deploy/pqc/serve.mjs --local
```

The listener binds only to loopback at `https://localhost:8443`. Set
`PQC_STAGE_PORT` to use another port. `PQC_OPENSSL` selects an absolute path
when the OpenSSL on PATH lacks ML-KEM or ML-DSA.

The launcher starts the intake process and prints the public path and SPKI
fingerprint of its temporary test certificate. It creates a test encryption
key, ML-DSA signing key, and inquiry store in a private temporary directory.
Stopping the launcher removes that directory and its test records. Use
synthetic inquiries on this disposable instance.

From another terminal, supply the test certificate shown by the launcher:

```sh
PQC_CA_FILE=/absolute/path/to/local-cert.pem \
node deploy/pqc/check.mjs https://localhost:8443
```

The check verifies the negotiated group and cipher suite, tests an offered
session ticket when one is available, rejects X25519-only, AES-128-only, TLS
1.2, and unknown TLS names, and checks public routes, readiness, and private
path denial.

## Hosted instance

1. Build the isolated bundle and install it read-only for the server accounts.
   Keep server source, TLS keys, inquiry keys, and records outside that bundle.
   Build a fresh directory for each release so the files match the CSP hashes
   loaded at startup.
2. Obtain a browser-trusted TLS certificate for the intended test hostname.
   Supply its chain as `PQC_TLS_CERT_FILE` and its private key as
   `PQC_TLS_KEY_FILE`. Use a dedicated, non-root service account and grant
   access to the listen port through the host's service manager when needed.
3. Start `node src/server/inquiries.mjs` under the intake account with:

   | Setting                        | Value                                                                     |
   | ------------------------------ | ------------------------------------------------------------------------- |
   | `PQC_PUBLIC_ORIGIN`            | Exact HTTPS origin, including a nondefault port, without a trailing slash |
   | `PQC_INQUIRY_SOCKET`           | Absolute path to a Unix socket in a private runtime directory             |
   | `PQC_INQUIRY_DIR`              | Absolute private data directory                                           |
   | `PQC_INQUIRY_KEY_FILE`         | Private file containing a 32-byte random encryption key                   |
   | `PQC_INQUIRY_SIGNING_KEY_FILE` | Private OpenSSL ML-DSA-87 PEM key                                         |

   Provision the two keys once and restrict each to mode `0600`. Give
   separate accounts socket access through a private shared group and
   `PQC_INQUIRY_SOCKET_MODE=0660`. Keep the intake directory and keys
   accessible only to the intake operator.

4. Run `node deploy/pqc/serve.mjs --check` with `PQC_WEB_ROOT`,
   `PQC_PUBLIC_ORIGIN`, `PQC_INQUIRY_SOCKET`, `PQC_TLS_CERT_FILE`,
   `PQC_TLS_KEY_FILE`, and `PQC_HTTPS_LISTEN`. The listen value is one IP and
   port, such as `0.0.0.0:443` or `[::]:443`. Run the same command without
   `--check` to start the server.
5. Set `PQC_HTTPS_ALIAS=www.levnat.ca` when the canonical origin is
   `https://levnat.ca` and the certificate SAN covers both hosts. The alias
   accepts the same strict TLS and redirects GET and HEAD to the canonical
   origin. POST on the alias receives 405. Other TLS names are rejected.
   Validate every published DNS address family and every TLS hop before
   changing the public domain. A CDN that terminates TLS must enforce the
   corresponding policy on each connection.

Read a stored inquiry only from the private operator account. Set
`PQC_INQUIRY_DIR`, `PQC_INQUIRY_KEY_FILE`, and `PQC_INQUIRY_VERIFY_KEY_FILE`
to the corresponding storage directory, encryption key, and ML-DSA public PEM
key. Derive the public key from the signing key with OpenSSL `pkey -pubout`.
Run `node src/server/inquiries.mjs read <receipt>` in a private operator
session. The reader verifies the signature before displaying the decrypted
record. Its output contains the inquiry contents.

## Acceptance before switching the public domain

| Failure                                                     | Probability / impact | Detection and prevention                                                                                                                    |
| ----------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Classical fallback or a resumed session bypasses the policy | Medium / high        | Run `check.mjs` on the target. Probe every alias and TLS hop separately. Keep the canonical and alias listeners strict.                     |
| Private files or plaintext intake become reachable          | Medium / high        | Probe blocked paths and send synthetic valid and invalid POSTs. Use the isolated bundle, same-origin requests, and the private Unix socket. |
| A device loses access or a route fails                      | High / high          | Open Galaxy and all seven service flows and complete a test inquiry from the target iPhone and Android devices before switching DNS.        |

The TLS policy covers browser connections to this server. Verify each
externally hosted service separately. ML-DSA-87 signs stored inquiry
records. The TLS certificate uses the algorithm of the supplied
browser-trusted certificate.

See [NGINX PQC](https://blog.nginx.org/blog/pqc-nginx),
[NGINX TLS directives](https://nginx.org/en/docs/http/ngx_http_ssl_module.html),
[OpenSSL TLS groups](https://docs.openssl.org/3.5/man3/SSL_CONF_cmd/).
