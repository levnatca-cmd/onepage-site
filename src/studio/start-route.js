export const DAYBOOK_DEMO_PATH = "/work/daybook/demo/";

export function isLegacyDaybookLocation({ search, hash }) {
  return (
    hash === "#live-system" ||
    hash === "#system-workbench" ||
    new URLSearchParams(search).get("lab") === "1"
  );
}

export function resolveStartDestination(browser) {
  const { search, hash } = browser.location;
  if (isLegacyDaybookLocation(browser.location)) return DAYBOOK_DEMO_PATH + search + hash;

  let prefersDark = false;
  try {
    prefersDark = browser.matchMedia?.("(prefers-color-scheme: dark)")?.matches === true;
  } catch {
    // Restricted browser contexts can fail to report a theme. Use the light home page.
  }

  const destination = prefersDark ? "/starworld.html" : "/home/";
  return destination + search + hash;
}
