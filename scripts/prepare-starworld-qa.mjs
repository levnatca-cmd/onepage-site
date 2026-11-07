// Local-only browser diagnostics. Generated copy is excluded from publishing.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { projectPath } from "./lib/paths.mjs";
const qaDirectory = projectPath("artifacts/qa/starworld");
mkdirSync(qaDirectory, { recursive: true });
const source = readFileSync(projectPath("starworld.html"), "utf8");
const toolbar = `<div id="qa-tools" style="position:fixed;z-index:100;bottom:0;left:0;right:0;display:flex;gap:8px;padding:8px;background:#fff;color:#111;font:12px sans-serif;flex-wrap:wrap">
<button id="qa-loss" style="color:#111">QA lose WebGL</button><button id="qa-restore" style="color:#111">QA restore WebGL</button><button id="qa-text" style="color:#111">QA toggle 200% text</button><output id="qa-result">QA only</output></div>
<script>
let extension;const output=document.getElementById('qa-result');
document.getElementById('qa-loss').onclick=()=>{const canvas=document.getElementById('universe');extension=(canvas.getContext('webgl2')||canvas.getContext('webgl')).getExtension('WEBGL_lose_context');extension.loseContext();output.textContent='Loss requested';};
document.getElementById('qa-restore').onclick=()=>{extension.restoreContext();output.textContent='Restoration requested';};
document.getElementById('qa-text').onclick=()=>{document.documentElement.style.fontSize=document.documentElement.style.fontSize?'':'32px';output.textContent='Text size '+(document.documentElement.style.fontSize||'default');};
const originalURL=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{blob.text().then(text=>{output.textContent='Export captured';const result=document.createElement('pre');result.id='qa-export';result.hidden=true;result.textContent=text;document.body.append(result);});return originalURL(blob);};
</script>`;
writeFileSync(
  projectPath("artifacts/qa/starworld/runtime.html"),
  source.replace("</body>", toolbar + "</body>"),
);
const noWebGL = source.replace(
  "/* Systems Engineering service map.",
  "window.STARWORLD_THREE=undefined;\n/* Systems Engineering service map.",
);
writeFileSync(
  projectPath("artifacts/qa/starworld/no-webgl.html"),
  noWebGL.replace("</body>", toolbar + "</body>"),
);
console.log("Generated local diagnostic pages. Do not publish these copies.");
