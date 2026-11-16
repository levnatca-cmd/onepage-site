const walletImport = /import\s*\{\s*getWallets\s*\}\s*from\s*['"]https:\/\/esm\.sh\/@mysten\/wallet-standard['"]/;
const patchMarker = '// Points feedback: keep recovery visible and reuse the connected account.';

function replaceOnce(source, before, after) {
  const offset = source.indexOf(before);
  if (offset < 0 || source.indexOf(before, offset + before.length) >= 0) {
    throw new Error('Points patch no longer matches the original wallet module');
  }
  return source.slice(0, offset) + after + source.slice(offset + before.length);
}

export function patchPointsInline(source) {
  if (!walletImport.test(source) || source.includes(patchMarker)) return source;

  const start = source.indexOf('function showBalanceSection() {');
  const fetchStart = source.indexOf('async function fetchPoints(address) {', start);
  const fetchEnd = source.indexOf('\ndocument.addEventListener("DOMContentLoaded", async () => {', fetchStart);
  const end = source.indexOf('\non("register", () => findSlush());', fetchEnd);
  if (start < 0 || fetchStart < start || fetchEnd < fetchStart || end < fetchEnd) {
    throw new Error('Points patch no longer matches the original wallet module');
  }

  // Retain the snapshot's URL construction and direct points rendering verbatim.
  let fetchPoints = source.slice(fetchStart, fetchEnd);
  fetchPoints = replaceOnce(fetchPoints, '    const data = await res.json();',
    '    if (!res.ok) throw new Error("Points request failed");\n    const data = await res.json();');
  fetchPoints = replaceOnce(fetchPoints,
    '    if (!Array.isArray(data) || !data[0]) return;\n    const points = data[0].total_points ?? 0;',
    `    if (!Array.isArray(data)) throw new Error("Invalid points response");
    const points = data[0]?.total_points;
    if (points == null || points === "") return false;
    if ((typeof points !== "number" && typeof points !== "string") ||
        (typeof points === "string" && !points.trim()) || !Number.isFinite(Number(points))) {
        throw new Error("Invalid points total");
    }`);
  fetchPoints = replaceOnce(fetchPoints,
    '    document.querySelectorAll("[total-points]").forEach(el => el.textContent = points);',
    '    document.querySelectorAll("[total-points]").forEach(el => el.textContent = points);\n    return true;');

  return source.slice(0, start) + `${patchMarker}
${fetchPoints}
document.addEventListener("DOMContentLoaded", () => {
    const connectSection = document.getElementById("connect-section");
    const balanceSection = document.getElementById("balance-section");
    const btn = document.getElementById("connectWallet");
    const label = btn?.querySelector("[global-target]") || btn;
    const status = document.getElementById("walletStatus");
    let connectedAddress = null;
    let pending = false;

    function clearPoints() {
        document.querySelectorAll("[total-points]").forEach(el => el.textContent = "--");
    }

    function setStatus(message) {
        if (status) status.textContent = message;
    }

    function setLabel(message) {
        if (label) label.textContent = message;
    }

    function setBusy(busy) {
        if (btn) {
            btn.disabled = busy;
            btn.setAttribute("aria-busy", String(busy));
        }
        balanceSection?.setAttribute("aria-busy", String(busy));
    }

    connectSection?.style.setProperty("display", "flex");
    balanceSection?.style.setProperty("display", "none");
    status?.setAttribute("role", "status");
    status?.setAttribute("aria-live", "polite");
    status?.setAttribute("aria-atomic", "true");
    status?.style.setProperty("display", "block");
    clearPoints();
    setStatus("");
    setBusy(false);

    btn?.addEventListener("click", async (event) => {
        event.preventDefault();
        if (pending) return;
        pending = true;
        let nextAction = connectedAddress ? "Retry Points" : "Connect Wallet";
        clearPoints();
        setBusy(true);
        setLabel(connectedAddress ? "Loading points..." : "Connecting...");
        setStatus(connectedAddress ? "Loading points..." : "Connecting to Slush...");

        try {
            if (!connectedAddress) {
                if (!slushWallet) findSlush();
                if (!slushWallet) {
                    setStatus("Slush wallet not found. ");
                    const install = document.createElement("a");
                    install.href = "https://chromewebstore.google.com/detail/slush-a-sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil";
                    install.target = "_blank";
                    install.rel = "noopener noreferrer";
                    install.textContent = "Install Slush";
                    status?.append(install, " and try again.");
                    return;
                }

                await slushWallet.features["standard:connect"].connect();
                const account = slushWallet.accounts?.[0];
                if (!account || typeof account.address !== "string" || !account.address.trim()) {
                    setStatus("No account was selected. Try connecting again.");
                    return;
                }
                connectedAddress = account.address;
                window.connectedSuiAddress = connectedAddress;
            }

            nextAction = "Retry Points";
            balanceSection?.style.setProperty("display", "flex");
            setLabel("Loading points...");
            setStatus("Loading points...");
            if (await fetchPoints(connectedAddress)) {
                const shortAddress = connectedAddress.slice(0, 6) + "..." + connectedAddress.slice(-4);
                setStatus("Points loaded for " + shortAddress + ".");
                nextAction = "Refresh Points";
            } else {
                setStatus("No points data was returned for this wallet. Try again.");
            }
        } catch (err) {
            if (connectedAddress) {
                setStatus("Could not load points. Try again.");
            } else {
                setStatus("Wallet connection failed. " + (err?.message || "Try connecting again."));
            }
        } finally {
            pending = false;
            setBusy(false);
            setLabel(nextAction);
        }
    });
});
` + source.slice(end);
}
