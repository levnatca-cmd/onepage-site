function errorMessage(status) {
  if (status === 400) return "Check your email and project details, then try again.";
  if (status === 409)
    return "This request could not be matched to its receipt. Edit your details to start a new inquiry.";
  if (status === 429) return "Too many requests. Wait a few minutes and try again.";
  return "Could not confirm receipt. Your details are still here. Try again.";
}

export function bindSecureInquiry(form, { read, status, onSuccess = () => form.reset() }) {
  const submit = form.querySelector('button[type="submit"]');
  if (location.protocol !== "https:" || !isSecureContext || !globalThis.crypto?.randomUUID) {
    status.textContent = "Sending an inquiry requires the HTTPS version of this site.";
    return;
  }

  let pending = false;
  let lastRequest;
  let ready = false;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!ready || pending || !form.reportValidity()) return;
    const body = JSON.stringify(read());
    if (lastRequest?.body !== body) lastRequest = { body, key: crypto.randomUUID() };
    const { key } = lastRequest;

    pending = true;
    submit.disabled = true;
    form.setAttribute("aria-busy", "true");
    status.textContent = "Sending your inquiry…";
    let receipt;
    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        mode: "same-origin",
        credentials: "omit",
        redirect: "error",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": key,
        },
        body,
        signal: AbortSignal.timeout(15000),
      });
      if (response.status !== 201) {
        status.textContent = errorMessage(response.status);
        return;
      }
      const result = await response.json();
      if (result?.id !== key) {
        status.textContent = errorMessage(response.status);
        return;
      }
      receipt = result;
    } catch {
      status.textContent = errorMessage(0);
    } finally {
      pending = false;
      submit.disabled = false;
      form.removeAttribute("aria-busy");
    }

    if (receipt) {
      lastRequest = undefined;
      if (JSON.stringify(read()) === body) onSuccess(receipt);
      status.textContent = `Inquiry received. Reference ${receipt.id}.`;
    }
  });

  fetch("/api/inquiries/ready", {
    mode: "same-origin",
    credentials: "omit",
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  })
    .then((response) => {
      if (
        response.status !== 204 ||
        response.headers.get("X-Inquiry-Transport") !== "strict-pqc-v1"
      )
        throw new Error("Inquiry transport unavailable");
      ready = true;
      submit.disabled = false;
    })
    .catch(() => {
      status.textContent = "Secure sending is unavailable. Your details stay on this page.";
    });
}
