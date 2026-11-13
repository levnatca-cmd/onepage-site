import { readFileSync } from "node:fs";
import { DAYBOOK_DEMO_PATH } from "../src/studio/start-route.js";
import { projectPath } from "./lib/paths.mjs";

export function renderGalaxyHome() {
  return readFileSync(projectPath("explore.html"), "utf8")
    .replace(
      "<!DOCTYPE html>",
      "<!DOCTYPE html>\n<!-- Generated from explore.html by npm run build:studio. -->",
    )
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
        <a href="${DAYBOOK_DEMO_PATH}" data-galaxy-context-link>Daybook demo</a>
        <a href="/starworld.html" data-galaxy-context-link>Starworld service map</a>
        <a href="/" data-galaxy-context-link>Use device theme</a>`,
    );
}
