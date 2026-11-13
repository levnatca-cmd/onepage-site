#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parse } from "parse5";
import * as THREE from "../../vendor/three/three.module.min.js";
import { GALAXY_SERVICE_BY_ID } from "../../src/shared/service-catalog.js";
import { PLANETS, PLANET_IDS, QUESTION_FLOW } from "../../src/galaxy/js/data/quiz-data.js";
import { SYSTEM_PRESENTATIONS } from "../../src/galaxy/js/data/scene-presentations.js";
import {
  createServiceSpatialGrid,
  MAX_SERVICE_ORBIT_SCALE,
  sampleServiceGridPosition,
} from "../../src/galaxy/js/scene/service-spatial-grid.js";
import {
  createSpherePresentation,
  fitModelIntoSphere,
  retargetSpherePresentation,
  updateSpherePresentation,
} from "../../src/galaxy/js/scene/sphere-kit.js";
import { buildSystemModel } from "../../src/galaxy/js/scene/system-models/index.js";
import { updatePqcSignal } from "../../src/galaxy/js/scene/system-models/pqc.js";
import { modelParts } from "../../prototypes/galaxy-model-review/parts.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const QUIZ_DATA_PATH = "src/galaxy/js/data/quiz-data.js";
const PRESENTATIONS_PATH = "src/galaxy/js/data/scene-presentations.js";
const MODEL_INDEX_PATH = "src/galaxy/js/scene/system-models/index.js";
const GALAXY_PATH = "src/galaxy/js/galaxy.js";
const SPHERE_KIT_PATH = "src/galaxy/js/scene/sphere-kit.js";
const SERVICE_SPHERE_COVER_PATH = "src/galaxy/js/scene/service-sphere-cover.js";
const SERVICE_SPATIAL_GRID_PATH = "src/galaxy/js/scene/service-spatial-grid.js";
const EXPECTED_PLANET_COUNT = 7;

const results = [];

function report(ok, label, detail) {
  results.push({ ok, label, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${label}: ${detail}`);
}

function relativePath(absolutePath) {
  return path.relative(ROOT, absolutePath).split(path.sep).join("/");
}

function readProjectFile(relativeFile) {
  const absolutePath = path.join(ROOT, relativeFile);
  try {
    return { ok: true, source: readFileSync(absolutePath, "utf8"), absolutePath };
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return { ok: false, missing: true, absolutePath };
    }
    return {
      ok: false,
      missing: false,
      absolutePath,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function countNewlines(source, start, end) {
  let count = 0;
  for (let index = start; index < end; index += 1) {
    if (source[index] === "\n") count += 1;
  }
  return count;
}

function skipQuoted(source, start, quote) {
  let index = start + 1;
  while (index < source.length) {
    if (source[index] === "\\") {
      index += 2;
      continue;
    }
    if (source[index] === quote) return index + 1;
    index += 1;
  }
  return source.length;
}

function skipTemplateExpression(source, start) {
  let depth = 1;
  let index = start;
  while (index < source.length && depth > 0) {
    const char = source[index];
    const next = source[index + 1];
    if (char === "'" || char === '"') {
      index = skipQuoted(source, index, char);
    } else if (char === "`") {
      index = skipTemplate(source, index);
    } else if (char === "/" && next === "/") {
      const newline = source.indexOf("\n", index + 2);
      index = newline === -1 ? source.length : newline + 1;
    } else if (char === "/" && next === "*") {
      const close = source.indexOf("*/", index + 2);
      index = close === -1 ? source.length : close + 2;
    } else {
      if (char === "{") depth += 1;
      if (char === "}") depth -= 1;
      index += 1;
    }
  }
  return index;
}

function skipTemplate(source, start) {
  let index = start + 1;
  while (index < source.length) {
    if (source[index] === "\\") {
      index += 2;
    } else if (source[index] === "`") {
      return index + 1;
    } else if (source[index] === "$" && source[index + 1] === "{") {
      index = skipTemplateExpression(source, index + 2);
    } else {
      index += 1;
    }
  }
  return source.length;
}

function canStartRegex(tokens) {
  const previous = tokens[tokens.length - 1];
  if (!previous) return true;
  if (previous.type === "punctuator") {
    return new Set(["(", "[", "{", "=", ":", ",", ";", "!", "?", "=>"]).has(previous.value);
  }
  return (
    previous.type === "identifier" &&
    new Set([
      "case",
      "delete",
      "do",
      "else",
      "in",
      "instanceof",
      "of",
      "return",
      "throw",
      "typeof",
      "void",
      "yield",
    ]).has(previous.value)
  );
}

function skipRegex(source, start) {
  let index = start + 1;
  let inCharacterClass = false;
  while (index < source.length) {
    if (source[index] === "\\") {
      index += 2;
      continue;
    }
    if (source[index] === "[") inCharacterClass = true;
    if (source[index] === "]") inCharacterClass = false;
    if (source[index] === "/" && !inCharacterClass) {
      index += 1;
      while (/[a-z]/i.test(source[index] || "")) index += 1;
      return index;
    }
    if (source[index] === "\n") return index;
    index += 1;
  }
  return source.length;
}

function decodeStringLiteral(raw) {
  return raw.replace(
    /\\(?:u\{([0-9a-f]+)\}|u([0-9a-f]{4})|x([0-9a-f]{2})|([\\'"bfnrtv0]))/gi,
    function (_match, codePoint, unicode, hex, simple) {
      if (codePoint) return String.fromCodePoint(Number.parseInt(codePoint, 16));
      if (unicode) return String.fromCharCode(Number.parseInt(unicode, 16));
      if (hex) return String.fromCharCode(Number.parseInt(hex, 16));
      const escapes = { b: "\b", f: "\f", n: "\n", r: "\r", t: "\t", v: "\v", 0: "\0" };
      return Object.hasOwn(escapes, simple) ? escapes[simple] : simple;
    },
  );
}

function tokenizeJavaScript(source) {
  const tokens = [];
  let index = 0;
  let line = 1;

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (/\s/.test(char)) {
      if (char === "\n") line += 1;
      index += 1;
      continue;
    }

    if (char === "/" && next === "/") {
      const end = source.indexOf("\n", index + 2);
      if (end === -1) break;
      index = end;
      continue;
    }

    if (char === "/" && next === "*") {
      const close = source.indexOf("*/", index + 2);
      const end = close === -1 ? source.length : close + 2;
      line += countNewlines(source, index, end);
      index = end;
      continue;
    }

    if (char === "'" || char === '"') {
      const startLine = line;
      const end = skipQuoted(source, index, char);
      const contentEnd = end <= source.length && source[end - 1] === char ? end - 1 : end;
      tokens.push({
        type: "string",
        value: decodeStringLiteral(source.slice(index + 1, contentEnd)),
        line: startLine,
      });
      line += countNewlines(source, index, end);
      index = end;
      continue;
    }

    if (char === "`") {
      const startLine = line;
      const end = skipTemplate(source, index);
      tokens.push({ type: "template", value: "`template`", line: startLine });
      line += countNewlines(source, index, end);
      index = end;
      continue;
    }

    if (/[A-Za-z_$]/.test(char)) {
      const start = index;
      index += 1;
      while (/[A-Za-z0-9_$]/.test(source[index] || "")) index += 1;
      tokens.push({ type: "identifier", value: source.slice(start, index), line });
      continue;
    }

    if (/[0-9]/.test(char)) {
      const start = index;
      index += 1;
      while (/[0-9A-Fa-f_xXobOB.]/.test(source[index] || "")) index += 1;
      tokens.push({ type: "number", value: source.slice(start, index), line });
      continue;
    }

    if (char === "/" && canStartRegex(tokens)) {
      const end = skipRegex(source, index);
      tokens.push({ type: "regex", value: "/regex/", line });
      line += countNewlines(source, index, end);
      index = end;
      continue;
    }

    const threeCharacters = source.slice(index, index + 3);
    const twoCharacters = source.slice(index, index + 2);
    const value =
      threeCharacters === "..."
        ? threeCharacters
        : new Set(["=>", "?.", "??", "&&", "||", "==", "!=", ">=", "<=", "**"]).has(twoCharacters)
          ? twoCharacters
          : char;
    tokens.push({ type: "punctuator", value, line });
    index += value.length;
  }

  return tokens;
}

function findObjectStart(tokens, nameIndex) {
  let foundAssignment = false;
  for (let index = nameIndex + 1; index < tokens.length; index += 1) {
    const value = tokens[index].value;
    if (!foundAssignment) {
      if (value === "=") foundAssignment = true;
      if (value === ";") return -1;
      continue;
    }
    if (value === "{") return index;
    if (value === ";") return -1;
  }
  return -1;
}

function findClosingBrace(tokens, openIndex) {
  let depth = 0;
  for (let index = openIndex; index < tokens.length; index += 1) {
    if (tokens[index].value === "{") depth += 1;
    if (tokens[index].value === "}") depth -= 1;
    if (depth === 0) return index;
  }
  return -1;
}

function parseObjectProperty(segment) {
  if (!segment.length) return null;
  if (segment[0].value === "...") {
    return { error: `spread property at line ${segment[0].line} prevents an exact key check` };
  }
  if (segment[0].value === "[") {
    return { error: `computed property at line ${segment[0].line} prevents an exact key check` };
  }

  let keyIndex = 0;
  if (
    ["async", "get", "set"].includes(segment[0].value) &&
    segment[1] &&
    ["identifier", "string", "number"].includes(segment[1].type)
  ) {
    keyIndex = 1;
  }

  const keyToken = segment[keyIndex];
  if (!keyToken || !["identifier", "string", "number"].includes(keyToken.type)) {
    return { error: `unrecognized property at line ${segment[0].line}` };
  }

  const separator = segment[keyIndex + 1];
  if (separator && ![":", "(", "="].includes(separator.value)) {
    return { error: `unrecognized property syntax for ${keyToken.value} at line ${keyToken.line}` };
  }

  const valueTokens =
    separator && separator.value === ":"
      ? segment.slice(keyIndex + 2)
      : segment.slice(keyIndex, keyIndex + 1);
  return { key: String(keyToken.value), line: keyToken.line, valueTokens };
}

function parseObjectAt(tokens, openIndex) {
  const closeIndex = findClosingBrace(tokens, openIndex);
  if (closeIndex === -1) return { error: "object literal has no closing brace" };

  const segments = [];
  let segmentStart = openIndex + 1;
  let curlyDepth = 0;
  let bracketDepth = 0;
  let parenthesisDepth = 0;

  for (let index = openIndex + 1; index < closeIndex; index += 1) {
    const value = tokens[index].value;
    if (value === "{") curlyDepth += 1;
    else if (value === "}") curlyDepth -= 1;
    else if (value === "[") bracketDepth += 1;
    else if (value === "]") bracketDepth -= 1;
    else if (value === "(") parenthesisDepth += 1;
    else if (value === ")") parenthesisDepth -= 1;
    else if (value === "," && curlyDepth === 0 && bracketDepth === 0 && parenthesisDepth === 0) {
      segments.push(tokens.slice(segmentStart, index));
      segmentStart = index + 1;
    }
  }
  segments.push(tokens.slice(segmentStart, closeIndex));

  const properties = [];
  const errors = [];
  for (const segment of segments) {
    const property = parseObjectProperty(segment);
    if (!property) continue;
    if (property.error) errors.push(property.error);
    else properties.push(property);
  }

  if (errors.length) return { error: errors.join("; ") };
  return { properties, closeIndex };
}

function buildRegistry(tokens, name, openIndex) {
  const parsed = parseObjectAt(tokens, openIndex);
  if (parsed.error) return { error: `${name}: ${parsed.error}` };
  return { name, tokens, properties: parsed.properties };
}

function findRegistry(source, candidateNames, expectedKeys = []) {
  const tokens = tokenizeJavaScript(source);

  for (const candidate of candidateNames) {
    for (let index = 1; index < tokens.length; index += 1) {
      if (tokens[index].value !== candidate) continue;
      if (!["const", "let", "var"].includes(tokens[index - 1].value)) continue;
      const openIndex = findObjectStart(tokens, index);
      if (openIndex === -1)
        return { error: `${candidate} is not initialized with an object literal` };
      return buildRegistry(tokens, candidate, openIndex);
    }
  }

  for (let index = 0; index < tokens.length - 2; index += 1) {
    if (tokens[index].value !== "export" || tokens[index + 1].value !== "default") continue;
    const openIndex = findObjectStart(tokens, index);
    if (openIndex !== -1) return buildRegistry(tokens, "default export", openIndex);
    for (
      let cursor = index + 2;
      cursor < tokens.length && tokens[cursor].value !== ";";
      cursor += 1
    ) {
      if (tokens[cursor].value === "{") return buildRegistry(tokens, "default export", cursor);
    }
  }

  const exportedCandidates = [];
  for (let index = 0; index < tokens.length - 3; index += 1) {
    if (tokens[index].value !== "export") continue;
    if (!["const", "let", "var"].includes(tokens[index + 1].value)) continue;
    const nameToken = tokens[index + 2];
    if (!nameToken || nameToken.type !== "identifier") continue;
    const openIndex = findObjectStart(tokens, index + 2);
    if (openIndex === -1) continue;
    const registry = buildRegistry(tokens, nameToken.value, openIndex);
    if (registry.error) continue;
    const keys = new Set(registry.properties.map((property) => property.key));
    if (!expectedKeys.length || expectedKeys.some((key) => keys.has(key)))
      exportedCandidates.push(registry);
  }

  if (exportedCandidates.length === 1) return exportedCandidates[0];
  if (exportedCandidates.length > 1) {
    return {
      error: `registry is ambiguous among exports: ${exportedCandidates.map((item) => item.name).join(", ")}`,
    };
  }
  return { error: `no object registry found (expected ${candidateNames.join(" or ")})` };
}

function duplicates(values) {
  const seen = new Set();
  const repeated = new Set();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}

function exactKeyMismatch(actualKeys, expectedKeys) {
  const actualSet = new Set(actualKeys);
  const expectedSet = new Set(expectedKeys);
  const missing = expectedKeys.filter((key) => !actualSet.has(key));
  const extra = [...actualSet].filter((key) => !expectedSet.has(key));
  const repeated = duplicates(actualKeys);
  const issues = [];
  if (actualKeys.length !== expectedKeys.length)
    issues.push(`expected ${expectedKeys.length} entries, found ${actualKeys.length}`);
  if (missing.length) issues.push(`missing [${missing.join(", ")}]`);
  if (extra.length) issues.push(`extra [${extra.join(", ")}]`);
  if (repeated.length) issues.push(`duplicates [${repeated.join(", ")}]`);
  return issues;
}

function parseImportBindings(clause) {
  const bindings = new Set();
  const braceIndex = clause.findIndex((token) => token.value === "{");
  const starIndex = clause.findIndex((token) => token.value === "*");
  const firstSpecial =
    [braceIndex, starIndex].filter((index) => index !== -1).sort((a, b) => a - b)[0] ??
    clause.length;
  const defaultToken = clause
    .slice(0, firstSpecial)
    .find((token) => token.type === "identifier" && token.value !== "type");
  if (defaultToken) bindings.add(defaultToken.value);

  if (starIndex !== -1) {
    const asIndex = clause.findIndex((token, index) => index > starIndex && token.value === "as");
    if (asIndex !== -1 && clause[asIndex + 1]) bindings.add(clause[asIndex + 1].value);
  }

  if (braceIndex !== -1) {
    const closeIndex = clause.findIndex(
      (token, index) => index > braceIndex && token.value === "}",
    );
    const namedTokens = clause.slice(
      braceIndex + 1,
      closeIndex === -1 ? clause.length : closeIndex,
    );
    let start = 0;
    for (let index = 0; index <= namedTokens.length; index += 1) {
      if (index !== namedTokens.length && namedTokens[index].value !== ",") continue;
      const segment = namedTokens
        .slice(start, index)
        .filter((token) => token.type === "identifier" && token.value !== "type");
      const asIndex = segment.findIndex((token) => token.value === "as");
      const local = asIndex === -1 ? segment[0] : segment[asIndex + 1];
      if (local) bindings.add(local.value);
      start = index + 1;
    }
  }

  return bindings;
}

function staticImports(tokens) {
  const imports = [];
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].value !== "import") continue;
    if (tokens[index + 1] && ["(", "."].includes(tokens[index + 1].value)) continue;
    if (tokens[index + 1] && tokens[index + 1].type === "string") {
      imports.push({ specifier: tokens[index + 1].value, bindings: new Set() });
      continue;
    }
    let fromIndex = -1;
    for (let cursor = index + 1; cursor < tokens.length; cursor += 1) {
      if (tokens[cursor].value === ";") break;
      if (
        tokens[cursor].value === "from" &&
        tokens[cursor + 1] &&
        tokens[cursor + 1].type === "string"
      ) {
        fromIndex = cursor;
        break;
      }
    }
    if (fromIndex !== -1) {
      imports.push({
        specifier: tokens[fromIndex + 1].value,
        bindings: parseImportBindings(tokens.slice(index + 1, fromIndex)),
      });
    }
  }
  return imports;
}

function allModuleSpecifiers(tokens) {
  const specifiers = staticImports(tokens).map((entry) => entry.specifier);
  for (let index = 0; index < tokens.length - 2; index += 1) {
    if (
      tokens[index].value === "import" &&
      tokens[index + 1].value === "(" &&
      tokens[index + 2].type === "string"
    ) {
      specifiers.push(tokens[index + 2].value);
    }
    if (tokens[index].value === "export") {
      for (
        let cursor = index + 1;
        cursor < tokens.length && tokens[cursor].value !== ";";
        cursor += 1
      ) {
        if (
          tokens[cursor].value === "from" &&
          tokens[cursor + 1] &&
          tokens[cursor + 1].type === "string"
        ) {
          specifiers.push(tokens[cursor + 1].value);
          break;
        }
      }
    }
  }
  return specifiers;
}

function localModulePath(importerPath, specifier) {
  const cleanSpecifier = specifier.split(/[?#]/, 1)[0];
  if (cleanSpecifier.startsWith("."))
    return path.resolve(path.dirname(importerPath), cleanSpecifier);
  if (cleanSpecifier.startsWith("/")) return path.resolve(ROOT, `.${cleanSpecifier}`);
  return null;
}

function isInside(parent, child) {
  const relation = path.relative(parent, child);
  return (
    relation !== "" &&
    !relation.startsWith(`..${path.sep}`) &&
    relation !== ".." &&
    !path.isAbsolute(relation)
  );
}

function isFile(filePath) {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function checkModelModules(registry, planetKeys, modelIndexPath) {
  if (!registry || registry.error) {
    report(
      false,
      "model modules",
      `cannot derive module paths until ${MODEL_INDEX_PATH} has a readable registry`,
    );
    return;
  }
  if (!planetKeys.length) {
    report(
      false,
      "model modules",
      `cannot validate modules without ${QUIZ_DATA_PATH} PLANETS keys`,
    );
    return;
  }

  const modelDirectory = path.dirname(modelIndexPath);
  const imports = staticImports(registry.tokens);
  const importsByBinding = new Map();
  for (const imported of imports) {
    for (const binding of imported.bindings) {
      if (!importsByBinding.has(binding)) importsByBinding.set(binding, new Set());
      importsByBinding.get(binding).add(imported.specifier);
    }
  }

  const missing = [];
  const unwired = [];
  const referencedFiles = new Set();
  const propertiesByKey = new Map(registry.properties.map((property) => [property.key, property]));

  for (const key of planetKeys) {
    const property = propertiesByKey.get(key);
    if (!property) {
      unwired.push(key);
      continue;
    }

    const specifiers = new Set();
    const identifiers = new Set(
      property.valueTokens
        .filter((token) => token.type === "identifier")
        .map((token) => token.value),
    );
    for (const identifier of identifiers) {
      for (const specifier of importsByBinding.get(identifier) || []) specifiers.add(specifier);
    }
    for (let index = 0; index < property.valueTokens.length; index += 1) {
      const token = property.valueTokens[index];
      if (
        token.value === "import" &&
        property.valueTokens[index + 1] &&
        property.valueTokens[index + 1].value === "(" &&
        property.valueTokens[index + 2] &&
        property.valueTokens[index + 2].type === "string"
      ) {
        specifiers.add(property.valueTokens[index + 2].value);
      }
      if (token.type === "string" && /^\.{1,2}\/.+\.m?js(?:[?#].*)?$/.test(token.value)) {
        specifiers.add(token.value);
      }
    }

    const localFiles = [...specifiers]
      .map((specifier) => ({ specifier, absolutePath: localModulePath(modelIndexPath, specifier) }))
      .filter(
        (item) =>
          item.absolutePath &&
          isInside(modelDirectory, item.absolutePath) &&
          item.absolutePath !== modelIndexPath,
      );

    if (!localFiles.length) {
      unwired.push(key);
      continue;
    }

    for (const item of localFiles) {
      referencedFiles.add(item.absolutePath);
      if (!isFile(item.absolutePath)) missing.push(`${key} -> ${relativePath(item.absolutePath)}`);
    }
  }

  const issues = [];
  if (unwired.length) issues.push(`no local model module for [${unwired.join(", ")}]`);
  if (missing.length) issues.push(`missing [${missing.join(", ")}]`);
  if (issues.length) report(false, "model modules", issues.join("; "));
  else
    report(
      true,
      "model modules",
      `${planetKeys.length} registrations resolve to ${referencedFiles.size} existing local module files`,
    );
}

function extractHtmlAssetUrls(source) {
  const urls = [];
  const pattern = /\b(?:src|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  let match;
  while ((match = pattern.exec(source))) urls.push(match[1] || match[2] || match[3]);
  return urls;
}

function listJavaScriptFiles(directory) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listJavaScriptFiles(absolutePath));
    else if (entry.isFile() && /\.m?js$/i.test(entry.name)) files.push(absolutePath);
  }
  return files;
}

function versionValues(url) {
  const values = [];
  const pattern = /[?&]v=([^&#]*)/gi;
  let match;
  while ((match = pattern.exec(url))) values.push(match[1]);
  return values;
}

function checkCacheBusters(indexSource) {
  if (!indexSource) {
    report(false, "cache-buster", "cannot inspect index.html");
    return;
  }

  const references = [];
  const unversionedLocalImports = [];
  for (const url of extractHtmlAssetUrls(indexSource)) {
    for (const value of versionValues(url)) references.push({ scope: "index.html", value });
  }

  const unreadable = [];
  for (const absolutePath of listJavaScriptFiles(path.join(ROOT, "src/galaxy/js"))) {
    let source;
    try {
      source = readFileSync(absolutePath, "utf8");
    } catch (error) {
      unreadable.push(relativePath(absolutePath));
      continue;
    }
    for (const specifier of allModuleSpecifiers(tokenizeJavaScript(source))) {
      for (const value of versionValues(specifier))
        references.push({ scope: relativePath(absolutePath), value });
      const resolved = localModulePath(absolutePath, specifier);
      const cleanSpecifier = specifier.split(/[?#]/, 1)[0];
      if (
        resolved &&
        isInside(path.join(ROOT, "src/galaxy/js"), resolved) &&
        /\.m?js$/i.test(cleanSpecifier) &&
        versionValues(specifier).length === 0
      ) {
        unversionedLocalImports.push(`${relativePath(absolutePath)} -> ${specifier}`);
      }
    }
  }

  const indexReferences = references.filter((item) => item.scope === "index.html");
  const importReferences = references.filter((item) => item.scope !== "index.html");
  const invalid = references.filter((item) => !/^wow\d+$/.test(item.value));
  const unique = [...new Set(references.map((item) => item.value))];
  const issues = [];
  if (!indexReferences.length) issues.push("index.html has no wowNN asset version");
  if (!importReferences.length) issues.push("JS imports have no wowNN versions");
  if (invalid.length)
    issues.push(
      `invalid values [${[...new Set(invalid.map((item) => item.value || "empty"))].join(", ")}]`,
    );
  if (unique.length > 1) issues.push(`mixed values [${unique.join(", ")}]`);
  if (unversionedLocalImports.length)
    issues.push(`unversioned local imports [${unversionedLocalImports.join(", ")}]`);
  if (unreadable.length) issues.push(`unreadable JS [${unreadable.join(", ")}]`);

  if (issues.length) report(false, "cache-buster", issues.join("; "));
  else
    report(
      true,
      "cache-buster",
      `${unique[0]} across ${indexReferences.length} index assets and ${importReferences.length} versioned JS imports`,
    );
}

function htmlLineNumber(source, offset) {
  return countNewlines(source, 0, offset) + 1;
}

function findHtmlTagEnd(source, start) {
  let quote = null;
  for (let index = start + 1; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === quote && source[index - 1] !== "\\") quote = null;
    } else if (char === "'" || char === '"') {
      quote = char;
    } else if (char === ">") {
      return index;
    }
  }
  return source.length - 1;
}

function classNamesFromTag(tag) {
  const quoted = tag.match(/\bclass\s*=\s*(["'])([\s\S]*?)\1/i);
  const unquoted = quoted ? null : tag.match(/\bclass\s*=\s*([^\s>]+)/i);
  const value = quoted ? quoted[2] : unquoted ? unquoted[1] : "";
  return value.split(/\s+/).filter(Boolean);
}

function checkRigLabelNesting(indexSource) {
  if (!indexSource) {
    report(false, "rig label nesting", "cannot inspect index.html");
    return;
  }

  const stack = [];
  const nestedLines = [];
  let labelCount = 0;
  let index = 0;
  const voidElements = new Set([
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
  ]);

  while (index < indexSource.length) {
    const start = indexSource.indexOf("<", index);
    if (start === -1) break;
    if (indexSource.startsWith("<!--", start)) {
      const close = indexSource.indexOf("-->", start + 4);
      index = close === -1 ? indexSource.length : close + 3;
      continue;
    }
    const end = findHtmlTagEnd(indexSource, start);
    const tag = indexSource.slice(start, end + 1);
    index = end + 1;
    if (/^<!|^<\?/.test(tag)) continue;

    const closing = /^<\//.test(tag);
    const nameMatch = tag.match(/^<\/?\s*([A-Za-z][\w:-]*)/);
    if (!nameMatch) continue;
    const name = nameMatch[1].toLowerCase();

    if (closing) {
      const matchingIndex = stack.map((entry) => entry.name).lastIndexOf(name);
      if (matchingIndex !== -1) stack.splice(matchingIndex);
      continue;
    }

    const classes = classNamesFromTag(tag);
    const isRigLabel = classes.some(
      (className) => className === "rig-label" || /^rig(?:-[a-z0-9]+)*-label$/i.test(className),
    );
    if (isRigLabel) {
      labelCount += 1;
      if (stack.some((entry) => entry.classes.includes("rig-spin")))
        nestedLines.push(htmlLineNumber(indexSource, start));
    }

    if (!/\/\s*>$/.test(tag) && !voidElements.has(name)) stack.push({ name, classes });
  }

  if (!labelCount) report(false, "rig label nesting", "no rig label elements found in index.html");
  else if (nestedLines.length)
    report(
      false,
      "rig label nesting",
      `labels inside .rig-spin at index.html lines [${nestedLines.join(", ")}]`,
    );
  else report(true, "rig label nesting", `${labelCount} rig labels are outside .rig-spin`);
}

function stripCssComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));
}

function findCssOpeningBrace(source, start) {
  let quote = null;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === quote && source[index - 1] !== "\\") quote = null;
    } else if (char === "'" || char === '"') {
      quote = char;
    } else if (char === "{") {
      return index;
    }
  }
  return -1;
}

function findCssClosingBrace(source, openIndex) {
  let depth = 0;
  let quote = null;
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === quote && source[index - 1] !== "\\") quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function reducedMotionBlocks(source) {
  const css = stripCssComments(source);
  const blocks = [];
  const lower = css.toLowerCase();
  let cursor = 0;
  while (cursor < css.length) {
    const mediaIndex = lower.indexOf("@media", cursor);
    if (mediaIndex === -1) break;
    const openIndex = findCssOpeningBrace(css, mediaIndex + 6);
    if (openIndex === -1) break;
    const closeIndex = findCssClosingBrace(css, openIndex);
    if (closeIndex === -1) break;
    const header = css.slice(mediaIndex, openIndex);
    if (/prefers-reduced-motion\s*:\s*reduce/i.test(header)) {
      blocks.push(css.slice(openIndex + 1, closeIndex));
    }
    cursor = mediaIndex + 6;
  }
  return blocks;
}

function selectorHasClass(selector, className) {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${escaped}(?![A-Za-z0-9_-])`).test(selector);
}

function blockCoversMotion(block, className) {
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
  const reducingDeclaration =
    /(?:animation\s*:\s*none|animation-(?:duration|iteration-count|play-state)\s*:|transition\s*:\s*none|transition-duration\s*:|transform\s*:\s*none)/i;
  let match;
  while ((match = rulePattern.exec(block))) {
    if (selectorHasClass(match[1], className) && reducingDeclaration.test(match[2])) return true;
  }
  return false;
}

function localStylesheetPath(url) {
  const clean = url.split(/[?#]/, 1)[0];
  if (!/\.css$/i.test(clean) || /^[a-z]+:/i.test(clean) || clean.startsWith("//")) return null;
  return clean.startsWith("/") ? path.resolve(ROOT, `.${clean}`) : path.resolve(ROOT, clean);
}

function checkReducedMotion(indexSource) {
  if (!indexSource) {
    report(false, "reduced motion", "cannot inspect index.html styles");
    return;
  }

  const cssSources = [];
  const unreadable = [];
  const stylesheetPaths = new Set(
    extractHtmlAssetUrls(indexSource).map(localStylesheetPath).filter(Boolean),
  );
  for (const stylesheetPath of stylesheetPaths) {
    try {
      cssSources.push({
        name: relativePath(stylesheetPath),
        source: readFileSync(stylesheetPath, "utf8"),
      });
    } catch {
      unreadable.push(relativePath(stylesheetPath));
    }
  }
  const inlinePattern = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let inlineMatch;
  let inlineIndex = 0;
  while ((inlineMatch = inlinePattern.exec(indexSource))) {
    inlineIndex += 1;
    cssSources.push({ name: `index.html inline style ${inlineIndex}`, source: inlineMatch[1] });
  }

  const coverage = new Map([
    [".rig-spin", []],
    [".rig-shell", []],
  ]);
  for (const cssSource of cssSources) {
    for (const block of reducedMotionBlocks(cssSource.source)) {
      for (const className of coverage.keys()) {
        if (blockCoversMotion(block, className)) coverage.get(className).push(cssSource.name);
      }
    }
  }

  const missing = [...coverage]
    .filter(([, sources]) => !sources.length)
    .map(([className]) => className);
  const issues = [];
  if (missing.length) issues.push(`no prefers-reduced-motion rule for [${missing.join(", ")}]`);
  if (unreadable.length) issues.push(`unreadable stylesheets [${unreadable.join(", ")}]`);
  if (issues.length) report(false, "reduced motion", issues.join("; "));
  else report(true, "reduced motion", ".rig-spin and .rig-shell have active stylesheet coverage");
}

function checkSharedServiceSphereCover() {
  const galaxyFile = readProjectFile(GALAXY_PATH);
  const sphereKitFile = readProjectFile(SPHERE_KIT_PATH);
  const coverFile = readProjectFile(SERVICE_SPHERE_COVER_PATH);
  const files = [galaxyFile, sphereKitFile, coverFile];
  if (files.some((file) => !file.ok)) {
    const missing = files.filter((file) => !file.ok).map((file) => relativePath(file.absolutePath));
    report(false, "shared service sphere cover", `unreadable [${missing.join(", ")}]`);
    return;
  }

  const checks = [
    [
      "versioned cover import",
      /from\s+["']\.\/service-sphere-cover\.js\?v=wow\d+(?:&rev=[\w-]+)?["']/,
    ],
    [
      "single cover factory",
      /createServiceSphereCover\(\{\s*color,\s*radius,\s*config,\s*compact,\s*lightTheme\s*\}\)/,
    ],
    ["cover retarget delegation", /retargetServiceSphereCover\(presentation\.cover/],
    ["cover update delegation", /updateServiceSphereCover\(presentation\.cover/],
    [
      "cover compatibility aliases",
      /shell:\s*cover\.shell[\s\S]*arcMaterial:\s*cover\.arcMaterial/,
    ],
  ];
  const missing = checks
    .filter(([, pattern]) => !pattern.test(sphereKitFile.source))
    .map(([label]) => label);

  const coverChecks = [
    ["cover factory export", /export function createServiceSphereCover/],
    ["cover retarget export", /export function retargetServiceSphereCover/],
    ["cover updater export", /export function updateServiceSphereCover/],
    ["shared cover geometry", /geometry\.userData\.sharedResource\s*=\s*true/],
    ["cover identity", /userData\.serviceSphereCover\s*=\s*true/],
  ];
  missing.push(
    ...coverChecks.filter(([, pattern]) => !pattern.test(coverFile.source)).map(([label]) => label),
  );

  for (const context of ["planet", "rescue"]) {
    const pattern = new RegExp(`context:\\s*["']${context}["']`);
    if (!pattern.test(galaxyFile.source)) missing.push(`${context} presentation context`);
  }
  if (/context:\s*["']choice["']/.test(galaxyFile.source)) {
    missing.push("quiz builds a separate choice cover");
  }
  if (/COVER_(?:VERTEX|FRAGMENT)_SHADER/.test(sphereKitFile.source)) {
    missing.push("cover shader still embedded in sphere kit");
  }

  if (missing.length)
    report(false, "shared service sphere cover", `missing [${missing.join(", ")}]`);
  else
    report(
      true,
      "shared service sphere cover",
      "planet and overview services share one cover module without separate quiz covers",
    );
}

function checkServiceSpatialGrid() {
  const galaxyFile = readProjectFile(GALAXY_PATH);
  const gridFile = readProjectFile(SERVICE_SPATIAL_GRID_PATH);
  const stateFile = readProjectFile("src/galaxy/js/state.js");
  const files = [galaxyFile, gridFile, stateFile];
  if (files.some((file) => !file.ok)) {
    const missing = files.filter((file) => !file.ok).map((file) => relativePath(file.absolutePath));
    report(false, "service spatial grid", `unreadable [${missing.join(", ")}]`);
    return;
  }

  const checks = [
    ["seven-slot capacity", /export const SERVICE_GRID_CAPACITY\s*=\s*7/],
    ["grid factory", /export function createServiceSpatialGrid/],
    ["position sampler", /export function sampleServiceGridPosition/],
    ["trajectory tangent sampler", /export function sampleServiceGridTangent/],
    ["responsive updater", /export function updateServiceSpatialGrid/],
    ["minimum-separation audit", /export function getServiceGridMinimumSeparation/],
    ["track angular velocity", /lane\.phase\s*\+\s*motionTime\s*\*\s*lane\.orbit\.speed/],
    ["reduced-motion freeze", /options\.reducedMotion\s*\?\s*0\s*:\s*elapsed/],
  ];
  const missing = checks
    .filter(([, pattern]) => !pattern.test(gridFile.source))
    .map(([label]) => label);

  const sceneChecks = [
    ["versioned grid import", /from\s+["']\.\/scene\/service-spatial-grid\.js\?v=wow\d+["']/],
    ["PLANETS-driven assignment", /createServiceSpatialGrid\(\{[\s\S]*serviceIds:\s*PLANET_IDS/],
    ["service positions sample grid", /sampleServiceGridPosition\([\s\S]*galaxy\.rescueRigGrid/],
    ["connections follow lane tangent", /sampleServiceGridTangent\([\s\S]*serviceId/],
    ["grid visibility updater", /updateServiceSpatialGrid\(galaxy\.rescueRigGrid/],
  ];
  missing.push(
    ...sceneChecks
      .filter(([, pattern]) => !pattern.test(galaxyFile.source))
      .map(([label]) => label),
  );

  if (!/rescueRigGrid:\s*null/.test(stateFile.source)) missing.push("grid runtime state");

  if (missing.length) report(false, "service spatial grid", `missing [${missing.join(", ")}]`);
  else
    report(
      true,
      "service spatial grid",
      "seven deterministic lanes drive service positions, connection tangents, and reduced motion",
    );
}

function checkLiveModelGeometry() {
  const failures = [];
  const budgets = [];
  for (const id of PLANET_IDS) {
    const { color } = PLANETS[id];
    const config = SYSTEM_PRESENTATIONS[id];
    const { root: model } = buildSystemModel(id, color, { THREE });
    const presentation = createSpherePresentation({ id, model, color, config });
    const feedthroughParts = new Set();
    model.userData.sphereFeedthrough?.mount.traverse((part) => feedthroughParts.add(part));
    const renderedParts = [];
    const rotatingParts = [];
    let pieces = 0;
    let triangles = 0;
    model.traverse((part) => {
      if (part.userData.spin || part.userData.sweep || part.userData.sweepRing) {
        rotatingParts.push([part, part.rotation.z]);
      }
      if (part.userData.fault) part.scale.setScalar(2.103);
      if (!part.geometry) return;
      pieces += 1;
      if (!feedthroughParts.has(part)) renderedParts.push(part);
      if (!part.isMesh) return;
      const { index } = part.geometry;
      triangles += (index?.count ?? part.geometry.getAttribute("position").count) / 3;
    });
    presentation.spinPivot.scale.setScalar(1);
    const vertex = new THREE.Vector3();
    let actualRadius = 0;
    const phases = rotatingParts.length || id === "pqc" ? 24 : 1;
    for (let phase = 0; phase < phases; phase += 1) {
      for (const [part, start] of rotatingParts)
        part.rotation.z = start + (phase * Math.PI * 2) / phases;
      if (id === "pqc") updatePqcSignal(model, (phase * 4.8) / phases, false);
      presentation.root.updateMatrixWorld(true);
      for (const part of renderedParts) {
        const positions = part.geometry.getAttribute("position");
        for (let index = 0; index < positions.count; index += 1) {
          vertex.fromBufferAttribute(positions, index).applyMatrix4(part.matrixWorld);
          actualRadius = Math.max(actualRadius, vertex.length());
        }
      }
    }
    if (
      !Number.isFinite(actualRadius) ||
      actualRadius > presentation.radius + 1e-6 ||
      !pieces ||
      !triangles
    ) {
      failures.push(`${id} has missing or out-of-bounds geometry`);
    }
    if (pieces > 48 || triangles > 18000) failures.push(`${id} exceeds the model geometry budget`);
    budgets.push(`${id} ${pieces}/${triangles}`);
  }
  report(
    !failures.length,
    "live model geometry",
    failures.join("; ") ||
      `vertices fit shared covers through motion; parts/triangles: ${budgets.join(", ")}`,
  );
}

function checkReviewParts() {
  const failures = exactKeyMismatch(Object.keys(modelParts), PLANET_IDS);
  let checked = 0;

  function countDrawables(model) {
    let count = 0;
    model.traverse((object) => {
      if (object.geometry?.getAttribute("position")?.count) count += 1;
    });
    return count;
  }

  for (const [id, parts] of Object.entries(modelParts)) {
    if (!Object.hasOwn(PLANETS, id)) continue;
    const { color } = PLANETS[id];
    const fullCount = countDrawables(buildSystemModel(id, color, { THREE }).root);
    for (const part of Object.keys(parts)) {
      const { root } = buildSystemModel(id, color, { THREE, part });
      const count = countDrawables(root);
      const { fittedRadius } = fitModelIntoSphere(root, 0.96);
      if (count === 0 || count >= fullCount || !Number.isFinite(fittedRadius)) {
        failures.push(`${id}/${part} does not fit as an isolated component`);
      }
      checked += 1;
    }
  }
  report(
    !failures.length,
    "isolated model review",
    failures.join("; ") || `${checked} live components`,
  );
}

function checkHardwareFeedthrough() {
  const { color } = PLANETS.hardware;
  const config = SYSTEM_PRESENTATIONS.hardware;
  const { root: model } = buildSystemModel("hardware", color, { THREE });
  const port = model.userData.sphereFeedthrough;
  if (!port) {
    report(false, "hardware feedthrough", "missing the shell mount");
    return;
  }
  const host = new THREE.Group();
  host.add(model);
  const presentation = createSpherePresentation({
    id: "hardware",
    model: host,
    color,
    config,
    context: "choice",
    radius: config.choiceRadius,
  });
  const cable = port.mount.getObjectByName("hardware-exterior-cable");
  const failures = [];

  function checkMount(label) {
    const radius = presentation.radius;
    presentation.root.updateMatrixWorld(true);
    const seam = port.mount.getWorldPosition(new THREE.Vector3());
    const anchor = model.localToWorld(port.anchor.clone());
    const insideEnd = port.lead.localToWorld(new THREE.Vector3(-1, 0, 0));
    if (Math.abs(seam.length() - radius) > 1e-6 || insideEnd.distanceTo(anchor) > 1e-6) {
      failures.push(label + " has a gap at the shell or inner lead");
    }

    const vertex = new THREE.Vector3();
    let reach = 0;
    cable?.traverse((part) => {
      const positions = part.geometry?.getAttribute("position");
      for (let index = 0; index < (positions?.count ?? 0); index += 1) {
        vertex.fromBufferAttribute(positions, index).applyMatrix4(part.matrixWorld);
        reach = Math.max(reach, vertex.length());
      }
    });
    if (reach < radius * 1.14 || reach > radius * 1.3) {
      failures.push(label + " exterior cable reach is out of range");
    }
  }

  checkMount("initial view");
  updateSpherePresentation(presentation, { delta: 0.15, elapsed: 0.15, selected: true });
  checkMount("reveal");
  updateSpherePresentation(presentation, { delta: 0, elapsed: 1, debugPhase: 0.43 });
  checkMount("rotated view");
  retargetSpherePresentation(presentation, { radius: config.rescueRadius });
  updateSpherePresentation(presentation, { delta: 0, elapsed: 0, reducedMotion: true });
  checkMount("refitted view");
  report(
    !failures.length,
    "hardware feedthrough",
    failures.join("; ") ||
      "flange stays on the shell and the cable joins the inner route during motion and refit",
  );
}

function checkPqcModel(indexSource) {
  const missing = [];
  const { color } = PLANETS.pqc;
  const { root } = buildSystemModel("pqc", color, { THREE });
  const config = SYSTEM_PRESENTATIONS.pqc;
  const presentation = createSpherePresentation({ id: "pqc", model: root, color, config });
  if (presentation.fit.fittedRadius > presentation.innerRadius + 1e-6) missing.push("cover fit");
  const { uBaseAlpha, uRimAlpha } = presentation.cover.shellMaterial.uniforms;
  const initialRim = uRimAlpha.value;
  updateSpherePresentation(presentation, { delta: 0, elapsed: 3.4 });
  const frozenRim = uRimAlpha.value;
  updateSpherePresentation(presentation, {
    delta: 0,
    elapsed: 0,
    selected: true,
    reducedMotion: true,
  });
  if (
    initialRim < 0.4 ||
    frozenRim < 0.4 ||
    uRimAlpha.value <= frozenRim ||
    uBaseAlpha.value > 0.04
  ) {
    missing.push("visible rim and clear center at startup, frozen time, and reduced motion");
  }
  const { raw, secured, outlet } = root.userData.pqc;
  if (
    updatePqcSignal(root, 0.7, false) !== -1 ||
    !raw.visible ||
    secured.visible ||
    raw.position.x >= 0
  ) {
    missing.push("unprotected intake");
  }
  if (
    updatePqcSignal(root, 2, false) !== -1 ||
    raw.visible ||
    !secured.visible ||
    secured.position.x <= 0
  ) {
    missing.push("protected output");
  }
  updatePqcSignal(root, 2.8 - 1e-6, false);
  if (
    outlet.position.distanceTo(secured.position) > 1e-5 ||
    updatePqcSignal(root, 2.8, false) !== 0
  ) {
    missing.push("outlet-to-cable handoff");
  }
  if (
    updatePqcSignal(root, 3.4, false) <= 0 ||
    raw.visible ||
    secured.visible ||
    updatePqcSignal(root, 4.4, false) !== -1
  ) {
    missing.push("core arrival and reset");
  }
  if (
    updatePqcSignal(root, 0, true) !== updatePqcSignal(root, 3.4, true) ||
    !raw.visible ||
    !secured.visible
  ) {
    missing.push("static before/after view");
  }
  if (!/data-planet="pqc"/.test(indexSource || "")) missing.push("layer control");
  report(
    !missing.length,
    "PQC bridge",
    missing.join(", ") ||
      "clear cover with a visible rim; intake, protection, handoff, and reduced motion verified",
  );

  const clearance = ["atom", "planets"].map((layout) => {
    const grid = createServiceSpatialGrid({ serviceIds: PLANET_IDS, layout });
    const points = PLANET_IDS.map(() => new THREE.Vector3());
    const lanes = PLANET_IDS.map((id) => grid.assignments.get(id));
    const radii = PLANET_IDS.map(
      (id, index) =>
        SYSTEM_PRESENTATIONS[id].rescueRadius * lanes[index].bodyScale * MAX_SERVICE_ORBIT_SCALE,
    );
    const sampleCount = 4096;
    const interval = grid.cycleDuration / sampleCount;
    const speedBound = Math.max(...lanes.map(({ orbit }) => orbit.radius * Math.abs(orbit.speed)));
    let minGap = Infinity;
    for (let step = 0; step < sampleCount; step += 1) {
      PLANET_IDS.forEach((id, index) =>
        sampleServiceGridPosition(grid, id, step * interval, points[index]),
      );
      for (let a = 0; a < points.length; a += 1) {
        for (let b = a + 1; b < points.length; b += 1) {
          minGap = Math.min(minGap, points[a].distanceTo(points[b]) - radii[a] - radii[b]);
        }
      }
    }
    // A pair can close at most twice the fastest speed between samples. The
    // nearest sample is at most half an interval away anywhere in the cycle.
    const guaranteedGap = minGap - speedBound * interval;
    const gaps = [guaranteedGap, guaranteedGap * grid.compactScale];
    const measuredSpeeds = PLANET_IDS.map((id) => {
      const start = sampleServiceGridPosition(grid, id, 0, new THREE.Vector3());
      const next = sampleServiceGridPosition(grid, id, 1, new THREE.Vector3());
      return start.angleTo(next).toFixed(3);
    });
    return {
      valid:
        grid.layout === layout &&
        grid.assignments.size === 7 &&
        grid.assignments.get("pqc")?.slotIndex === 3 &&
        new Set(measuredSpeeds).size === 3 &&
        gaps.every((gap) => gap > 0.05),
      detail: `${layout} ${gaps[0].toFixed(3)} desktop, ${gaps[1].toFixed(3)} compact`,
    };
  });
  report(
    clearance.every(({ valid }) => valid),
    "seven-sphere clearance",
    `minimum full-orbit shell gap: ${clearance.map(({ detail }) => detail).join("; ")}`,
  );
}

function checkQuizServiceCoverage() {
  const failures = QUESTION_FLOW.flatMap(({ id, choices }) => {
    const serviceIds = choices.map((choice) => choice.serviceId);
    const repeated = duplicates(serviceIds);
    const missing = PLANET_IDS.filter((serviceId) => !serviceIds.includes(serviceId));
    const unknown = serviceIds.filter((serviceId) => !Object.hasOwn(PLANETS, serviceId));
    const issues = [];
    if (choices.length !== EXPECTED_PLANET_COUNT) issues.push(`${choices.length} choices`);
    if (repeated.length) issues.push(`duplicates [${repeated.join(", ")}]`);
    if (missing.length) issues.push(`missing [${missing.join(", ")}]`);
    if (unknown.length) issues.push(`unknown [${unknown.join(", ")}]`);
    return issues.length ? [`${id}: ${issues.join(", ")}`] : [];
  });
  report(
    failures.length === 0,
    "quiz service coverage",
    failures.join("; ") || "each question maps exactly once to all seven overview services",
  );
}

function checkRuntimeSafetyContracts(indexSource) {
  const galaxyFile = readProjectFile(GALAXY_PATH);
  const uiFile = readProjectFile("src/galaxy/js/ui.js");
  if (!galaxyFile.ok || !uiFile.ok || !indexSource) {
    report(false, "runtime safety", "cannot inspect galaxy, UI, and index contracts");
    return;
  }

  const checks = [
    ["WebGL loss listener", /addEventListener\(["']webglcontextlost["']/],
    ["WebGL loss prevention", /webglcontextlost[\s\S]*event\.preventDefault\(\)/],
    [
      "WebGL restore recovery",
      /addEventListener\(["']webglcontextrestored["'][\s\S]*window\.location\.reload\(\)/,
    ],
    ["service-row lifecycle", /galaxy:service-row-transition-end/],
  ];
  const sources = [galaxyFile.source, uiFile.source, indexSource].join("\n");
  const missing = checks.filter(([, pattern]) => !pattern.test(sources)).map(([label]) => label);
  const attrs = (node) =>
    Object.fromEntries((node.attrs ?? []).map(({ name, value }) => [name, value]));
  const descendants = (node) =>
    (node.childNodes ?? []).flatMap((child) => [child, ...descendants(child)]);
  const nodes = descendants(parse(indexSource));
  const row = nodes.find(
    (node) => node.tagName === "nav" && attrs(node).class === "galaxy-service-row",
  );
  const catalog = nodes.find((node) => node.tagName === "nav" && attrs(node).id === "services");
  const archive = nodes.find(
    (node) => node.tagName === "template" && attrs(node).id === "galaxy-quiz-archive",
  );
  const archiveNodes = (node) =>
    (node?.content?.childNodes ?? node?.childNodes ?? []).flatMap((child) => [
      child,
      ...archiveNodes(child),
    ]);

  for (const [section, label] of [
    [row, "formation"],
    [catalog, "fallback"],
  ]) {
    const links = section
      ? descendants(section).filter(
          (node) => node.tagName === "a" && attrs(node)["data-galaxy-service-link"],
        )
      : [];
    const issues = exactKeyMismatch(
      links.map((node) => attrs(node)["data-galaxy-service-link"]),
      PLANET_IDS,
    );
    if (
      issues.length ||
      links.some((node) => {
        const link = attrs(node);
        return link.href !== GALAXY_SERVICE_BY_ID[link["data-galaxy-service-link"]]?.path;
      })
    )
      missing.push(label + " service links");
  }
  if (!row || !Object.hasOwn(attrs(row), "hidden"))
    missing.push("initially hidden service formation");
  if (
    nodes.some((node) =>
      ["quiz-console", "choice-options", "fingerprint-form"].includes(attrs(node).id),
    )
  ) {
    missing.push("quiz absent from live DOM");
  }
  for (const id of ["quiz-console", "choice-options", "fingerprint-form"]) {
    if (!archiveNodes(archive).some((node) => attrs(node).id === id))
      missing.push("archived " + id);
  }
  if (missing.length) report(false, "runtime safety", `missing [${missing.join(", ")}]`);
  else
    report(
      true,
      "runtime safety",
      "context recovery, seven native service links in both layouts, and inactive quiz",
    );
}

function main() {
  let planetKeys = [];
  const quizData = readProjectFile(QUIZ_DATA_PATH);
  if (!quizData.ok) {
    report(
      false,
      "PLANETS",
      quizData.missing
        ? `missing ${QUIZ_DATA_PATH}`
        : `cannot read ${QUIZ_DATA_PATH}: ${quizData.error}`,
    );
  } else {
    const planets = findRegistry(quizData.source, ["PLANETS"]);
    if (planets.error) {
      report(false, "PLANETS", planets.error);
    } else {
      const parsedKeys = planets.properties.map((property) => property.key);
      planetKeys = [...new Set(parsedKeys)];
      const repeated = duplicates(parsedKeys);
      const issues = [];
      if (parsedKeys.length !== EXPECTED_PLANET_COUNT)
        issues.push(`expected ${EXPECTED_PLANET_COUNT} entries, found ${parsedKeys.length}`);
      if (repeated.length) issues.push(`duplicates [${repeated.join(", ")}]`);
      if (issues.length)
        report(false, "PLANETS", `${issues.join("; ")}; derived [${planetKeys.join(", ")}]`);
      else report(true, "PLANETS", `${parsedKeys.length} keys [${parsedKeys.join(", ")}]`);
    }
  }

  const presentationsFile = readProjectFile(PRESENTATIONS_PATH);
  if (!presentationsFile.ok) {
    report(
      false,
      "scene presentations",
      presentationsFile.missing
        ? `missing ${PRESENTATIONS_PATH}`
        : `cannot read ${PRESENTATIONS_PATH}: ${presentationsFile.error}`,
    );
  } else if (!planetKeys.length) {
    report(false, "scene presentations", `cannot compare keys without ${QUIZ_DATA_PATH} PLANETS`);
  } else {
    const presentations = findRegistry(
      presentationsFile.source,
      [
        "SYSTEM_PRESENTATIONS",
        "SCENE_PRESENTATIONS",
        "PLANET_PRESENTATIONS",
        "systemPresentations",
        "scenePresentations",
        "planetPresentations",
      ],
      planetKeys,
    );
    if (presentations.error) {
      report(false, "scene presentations", presentations.error);
    } else {
      const keys = presentations.properties.map((property) => property.key);
      const issues = exactKeyMismatch(keys, planetKeys);
      if (issues.length) report(false, "scene presentations", issues.join("; "));
      else
        report(
          true,
          "scene presentations",
          `${presentations.name} matches all ${planetKeys.length} PLANETS keys`,
        );
    }
  }

  const modelIndex = readProjectFile(MODEL_INDEX_PATH);
  let modelRegistry = null;
  if (!modelIndex.ok) {
    report(
      false,
      "system model registry",
      modelIndex.missing
        ? `missing ${MODEL_INDEX_PATH}`
        : `cannot read ${MODEL_INDEX_PATH}: ${modelIndex.error}`,
    );
  } else if (!planetKeys.length) {
    report(false, "system model registry", `cannot compare keys without ${QUIZ_DATA_PATH} PLANETS`);
  } else {
    modelRegistry = findRegistry(
      modelIndex.source,
      [
        "SYSTEM_MODELS",
        "SYSTEM_MODEL_BUILDERS",
        "SYSTEM_MODEL_FACTORIES",
        "SYSTEM_MODEL_REGISTRY",
        "MODEL_BUILDERS",
        "MODEL_FACTORIES",
        "MODEL_REGISTRY",
        "systemModels",
        "systemModelBuilders",
        "systemModelFactories",
        "systemModelRegistry",
      ],
      planetKeys,
    );
    if (modelRegistry.error) {
      report(false, "system model registry", modelRegistry.error);
    } else {
      const keys = modelRegistry.properties.map((property) => property.key);
      const issues = exactKeyMismatch(keys, planetKeys);
      if (issues.length) report(false, "system model registry", issues.join("; "));
      else
        report(
          true,
          "system model registry",
          `${modelRegistry.name} registers all ${planetKeys.length} PLANETS keys`,
        );
    }
  }
  checkModelModules(modelRegistry, planetKeys, modelIndex.absolutePath);

  const indexFile = readProjectFile("explore.html");
  if (!indexFile.ok)
    report(
      false,
      "index.html",
      indexFile.missing ? "missing index.html" : `cannot read index.html: ${indexFile.error}`,
    );
  const indexSource = indexFile.ok ? indexFile.source : null;
  checkCacheBusters(indexSource);
  checkRigLabelNesting(indexSource);
  checkReducedMotion(indexSource);
  checkSharedServiceSphereCover();
  checkServiceSpatialGrid();
  checkLiveModelGeometry();
  checkReviewParts();
  checkHardwareFeedthrough();
  checkPqcModel(indexSource);
  checkQuizServiceCoverage();
  checkRuntimeSafetyContracts(indexSource);
}

try {
  main();
} catch (error) {
  report(false, "checker", error instanceof Error ? error.message : String(error));
}

const failures = results.filter((result) => !result.ok).length;
console.log(
  `${failures ? "FAIL" : "PASS"} scene contract: ${results.length - failures} passed, ${failures} failed`,
);
if (failures) process.exitCode = 1;
