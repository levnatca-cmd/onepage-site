import { readFileSync } from "node:fs";
import { DAYBOOK_DEMO_PATH } from "../../website/src/studio/start-route.js";
import { INQUIRY_EMAIL_DRAFT_URL } from "../../website/src/studio/inquiry.js";
import {
  BILLING_EXCLUSIONS,
  BILLING_TERMS,
  HOURLY_RATE,
  HOURLY_RATE_LABEL,
} from "../../website/src/studio/pricing.js";
import { websitePath } from "./lib/paths.mjs";

export function renderGalaxyPages() {
  const dark = readFileSync(websitePath("src/galaxy/index.html"), "utf8")
    .replace(
      "<!DOCTYPE html>",
      "<!DOCTYPE html>\n<!-- Generated from website/src/galaxy/index.html by npm run build:studio. -->",
    )
    .replace('"{{hourlyPrice}}"', JSON.stringify(HOURLY_RATE))
    .replaceAll("{{hourlyRate}}", () => HOURLY_RATE_LABEL)
    .replaceAll("{{billingTerms}}", () => BILLING_TERMS)
    .replace("{{billingExclusions}}", () => BILLING_EXCLUSIONS)
    .replace("{{inquiryEmailDraftHref}}", () => INQUIRY_EMAIL_DRAFT_URL.replaceAll("&", "&amp;"));
  const light = dark
    .replace(
      '<html lang="en-CA" dir="ltr">',
      '<html lang="en-CA" dir="ltr" data-galaxy-theme="light">',
    )
    .replace(
      "<title>Interactive Project Explorer | Systems Engineering</title>",
      "<title>Website &amp; App Development | LEVNAT</title>",
    )
    .replace('name="theme-color" content="#07090d"', 'name="theme-color" content="#edf4f8"')
    .replace('name="color-scheme" content="dark"', 'name="color-scheme" content="light"')
    .replace(
      'rel="canonical" href="https://levnat.ca/"',
      'rel="canonical" href="https://levnat.ca/home/"',
    )
    .replace(
      'property="og:url" content="https://levnat.ca/"',
      'property="og:url" content="https://levnat.ca/home/"',
    )
    .replace(/\b(href|src)="\.\//g, '$1="/')
    .replace(
      "    <noscript>",
      `    <link rel="stylesheet" href="/src/galaxy/styles/light.css?v=wow60&amp;rev=galaxy-light1" />
    <script type="module" src="/src/studio/home-route.js"></script>
    <noscript>`,
    )
    .replace(
      '<a href="/home/" data-galaxy-context-link>Light</a>',
      '<span aria-current="page">Light</span>',
    )
    .replace(
      '<span aria-current="page">Dark</span>',
      '<a href="/explore.html" data-galaxy-context-link>Dark</a>',
    )
    .replace(
      '<nav class="footer-nav" aria-label="Footer">',
      `<nav class="footer-nav" aria-label="Footer">
        <a href="${DAYBOOK_DEMO_PATH}" data-galaxy-context-link>Daybook demo</a>`,
    );
  return [
    ["explore.html", dark],
    ["home/index.html", light],
  ];
}
